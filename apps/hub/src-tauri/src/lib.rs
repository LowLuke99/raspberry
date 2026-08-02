//! Raspberry Hub — Rust entry point and local `Target` (spec §12).
//!
//! Phase 2 exposes the shared `core` crate to the frontend as Tauri commands.
//! The React side calls these via `invoke(...)` (LocalTarget). A future
//! RemoteTarget will send the same shapes over the wire to an Agent.
//!
//! Handler rules honored here:
//! - Every OS-touching call runs on the blocking pool via `spawn_blocking`,
//!   so `sysinfo` / PowerShell / `arp` never stall the async command worker.
//! - Every mutex lock uses `unwrap_or_else(|e| e.into_inner())`, so a single
//!   `sysinfo` panic never poisons the mutex and bricks every subsequent
//!   Tauri call.

mod terminal;

use std::sync::{Arc, Mutex};

use raspberry_core::{
    home_dir, list_dir, list_physical_disks, list_roots, packages_install, packages_list_installed,
    packages_list_upgradable, packages_search, packages_uninstall, packages_upgrade,
    packages_upgrade_all, read_events, security_snapshot, snapshot_connections, sysinfo_card,
    tcp_port_check, ConnectionSnapshot, FileEntry, LanDevice, LogEvent, Monitor, NetworkInfo,
    Package, PackageActionResult, PhysicalDisk, PortCheckResult, ProcessInfo, SecuritySnapshot,
    SysinfoCard, SystemSnapshot,
};
use tauri::State;
use terminal::Terminals;

/// App-wide state. The `Monitor` is behind an `Arc<Mutex<..>>` so blocking
/// work can clone the handle and move it into `spawn_blocking` instead of
/// holding the mutex on the async command worker.
struct AppState {
    monitor: Arc<Mutex<Monitor>>,
}

/// Lock the shared Monitor, tolerating a poisoned lock. A poisoned mutex just
/// means an earlier holder panicked mid-refresh — the data may be one tick
/// stale but is safe to read.
fn lock_monitor(m: &Mutex<Monitor>) -> std::sync::MutexGuard<'_, Monitor> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

#[tauri::command]
async fn system_snapshot(state: State<'_, AppState>) -> Result<SystemSnapshot, String> {
    let monitor = state.monitor.clone();
    tauri::async_runtime::spawn_blocking(move || lock_monitor(&monitor).snapshot())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn process_list(state: State<'_, AppState>) -> Result<Vec<ProcessInfo>, String> {
    let monitor = state.monitor.clone();
    tauri::async_runtime::spawn_blocking(move || lock_monitor(&monitor).processes())
        .await
        .map_err(|e| e.to_string())
}

/// Destructive: kill a process by pid. The frontend confirms before calling.
#[tauri::command]
async fn process_kill(state: State<'_, AppState>, pid: u32) -> Result<bool, String> {
    let monitor = state.monitor.clone();
    tauri::async_runtime::spawn_blocking(move || lock_monitor(&monitor).kill(pid))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn files_list(path: String) -> Result<Vec<FileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || list_dir(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn files_home() -> String {
    // Pure env-var read — cheap enough to stay on the command worker.
    home_dir()
}

#[tauri::command]
async fn files_roots() -> Vec<String> {
    // On Windows this stats up to 24 drive letters; keep it off the async
    // worker just in case a mapped network drive is slow.
    tauri::async_runtime::spawn_blocking(list_roots)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn network_info() -> NetworkInfo {
    tauri::async_runtime::spawn_blocking(raspberry_core::network_info)
        .await
        .unwrap_or_else(|_| NetworkInfo {
            interfaces: Vec::new(),
            local_ip: None,
            gateway_ip: None,
            gateway_mac: None,
        })
}

#[tauri::command]
async fn network_scan() -> Vec<LanDevice> {
    tauri::async_runtime::spawn_blocking(raspberry_core::scan_lan)
        .await
        .unwrap_or_default()
}

/// Deep scan: parallel-pings the local /24 to prime ARP, then re-reads it
/// with hostname + latency attached. Blocks for ~1-3s; the frontend shows
/// scanning state while it runs.
#[tauri::command]
async fn network_scan_deep() -> Vec<LanDevice> {
    tauri::async_runtime::spawn_blocking(raspberry_core::scan_lan_deep)
        .await
        .unwrap_or_default()
}

/// Send a Wake-on-LAN magic packet. State-changing but LAN-local and harmless
/// (worst case: nothing wakes); the frontend still confirms before calling.
#[tauri::command]
async fn wake_on_lan(mac: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || raspberry_core::wake_on_lan(&mac))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn storage_disks() -> Vec<PhysicalDisk> {
    tauri::async_runtime::spawn_blocking(list_physical_disks)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn security_status() -> SecuritySnapshot {
    tauri::async_runtime::spawn_blocking(security_snapshot)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn logs_read(log: String, max: u32) -> Vec<LogEvent> {
    tauri::async_runtime::spawn_blocking(move || read_events(&log, max))
        .await
        .unwrap_or_default()
}

// --- Packages (winget) ------------------------------------------------------

#[tauri::command]
async fn pkg_list() -> Result<Vec<Package>, String> {
    tauri::async_runtime::spawn_blocking(packages_list_installed)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pkg_upgradable() -> Result<Vec<Package>, String> {
    tauri::async_runtime::spawn_blocking(packages_list_upgradable)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pkg_search(query: String) -> Result<Vec<Package>, String> {
    tauri::async_runtime::spawn_blocking(move || packages_search(&query))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pkg_install(id: String) -> Result<PackageActionResult, String> {
    tauri::async_runtime::spawn_blocking(move || packages_install(&id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pkg_uninstall(id: String) -> Result<PackageActionResult, String> {
    tauri::async_runtime::spawn_blocking(move || packages_uninstall(&id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pkg_upgrade(id: String) -> Result<PackageActionResult, String> {
    tauri::async_runtime::spawn_blocking(move || packages_upgrade(&id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pkg_upgrade_all() -> Result<PackageActionResult, String> {
    tauri::async_runtime::spawn_blocking(packages_upgrade_all)
        .await
        .map_err(|e| e.to_string())?
}

// --- Sysinfo Card (fastfetch) ----------------------------------------------

#[tauri::command]
async fn sysinfo_card_cmd() -> SysinfoCard {
    tauri::async_runtime::spawn_blocking(sysinfo_card)
        .await
        .unwrap_or_else(|_| SysinfoCard {
            available: false,
            version: None,
            rows: Vec::new(),
            raw_json: String::new(),
            install_hint: Some("winget install --id Fastfetch-cli.Fastfetch -e".into()),
        })
}

// --- Watchtower: live TCP connection table ---------------------------------

/// One shot of the outbound-connection radar (spec §10, Watchtower). Runs
/// PowerShell (`Get-NetTCPConnection` + `Get-Process`) so the hop off the
/// UI thread matters — always spawn-blocking.
#[tauri::command]
async fn network_connections() -> ConnectionSnapshot {
    tauri::async_runtime::spawn_blocking(snapshot_connections)
        .await
        .unwrap_or_else(|_| ConnectionSnapshot {
            connections: Vec::new(),
            total: 0,
            listening: 0,
            established: 0,
            foreign_hosts: 0,
            unique_processes: 0,
            supported: true,
        })
}

// --- Toolbox: TCP port check -----------------------------------------------

#[tauri::command]
async fn port_check(host: String, port: u16, timeout_ms: Option<u64>) -> PortCheckResult {
    let timeout = timeout_ms.unwrap_or(1500);
    tauri::async_runtime::spawn_blocking(move || tcp_port_check(&host, port, timeout))
        .await
        .unwrap_or_else(|_| PortCheckResult {
            host: String::new(),
            port,
            open: false,
            latency_ms: None,
            error: Some("probe task panicked".into()),
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            monitor: Arc::new(Mutex::new(Monitor::new())),
        })
        .manage(Terminals::default())
        .invoke_handler(tauri::generate_handler![
            system_snapshot,
            process_list,
            process_kill,
            files_list,
            files_home,
            files_roots,
            network_info,
            network_scan,
            network_scan_deep,
            wake_on_lan,
            storage_disks,
            security_status,
            logs_read,
            pkg_list,
            pkg_upgradable,
            pkg_search,
            pkg_install,
            pkg_uninstall,
            pkg_upgrade,
            pkg_upgrade_all,
            sysinfo_card_cmd,
            network_connections,
            port_check,
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Raspberry Hub window");
}

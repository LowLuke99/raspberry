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
    packages_upgrade_all, read_events, scan_lan_deep, security_snapshot, snapshot_connections,
    sysinfo_card, tcp_port_check, ConnectionSnapshot, FileEntry, KeyProvider, KeyStatus, Keystore,
    LanDevice, LogEvent, Monitor, NetworkInfo, Package, PackageActionResult, PhysicalDisk,
    PortCheckResult, Presence, PresenceDevice, ProcessInfo, SecuritySnapshot, Sighting,
    SysinfoCard, SystemSnapshot,
};
use tauri::State;
use terminal::Terminals;

/// App-wide state. The `Monitor` is behind an `Arc<Mutex<..>>` so blocking
/// work can clone the handle and move it into `spawn_blocking` instead of
/// holding the mutex on the async command worker.
struct AppState {
    monitor: Arc<Mutex<Monitor>>,
    /// Presence DB — persistent LAN device registry. `None` if the on-disk
    /// SQLite file couldn't be opened; every command tolerates the None case
    /// and surfaces an error to the UI rather than crashing.
    presence: Arc<Option<Presence>>,
    /// Encrypted API-key vault, backed by Windows Credential Manager. The
    /// raw values NEVER cross the Tauri boundary — the frontend only sees
    /// presence booleans via `keystore_status`.
    keystore: Arc<Keystore>,
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

// --- Presence: persistent LAN device registry ------------------------------

#[tauri::command]
async fn presence_devices(
    state: State<'_, AppState>,
) -> Result<Vec<PresenceDevice>, String> {
    let presence = state.presence.clone();
    tauri::async_runtime::spawn_blocking(move || match presence.as_ref() {
        Some(p) => p.list_devices(),
        None => Err("presence db unavailable".into()),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn presence_sightings(
    state: State<'_, AppState>,
    mac: String,
    since_ms: u64,
) -> Result<Vec<Sighting>, String> {
    let presence = state.presence.clone();
    tauri::async_runtime::spawn_blocking(move || match presence.as_ref() {
        Some(p) => p.sightings(&mac, since_ms),
        None => Err("presence db unavailable".into()),
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Manual "rescan now" trigger for the Presence panel. Runs the deep scan,
/// records it, and returns the newly-seen MACs so the UI can flash them.
#[tauri::command]
async fn presence_rescan(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let presence = state.presence.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let devices = scan_lan_deep();
        match presence.as_ref() {
            Some(p) => p.record_scan(&devices),
            None => Err("presence db unavailable".into()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn presence_set_tag(
    state: State<'_, AppState>,
    mac: String,
    tag: Option<String>,
) -> Result<(), String> {
    let presence = state.presence.clone();
    tauri::async_runtime::spawn_blocking(move || match presence.as_ref() {
        Some(p) => p.set_tag(&mac, tag.as_deref()),
        None => Err("presence db unavailable".into()),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn presence_set_alert(
    state: State<'_, AppState>,
    mac: String,
    on: bool,
) -> Result<(), String> {
    let presence = state.presence.clone();
    tauri::async_runtime::spawn_blocking(move || match presence.as_ref() {
        Some(p) => p.set_alert(&mac, on),
        None => Err("presence db unavailable".into()),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn presence_forget(
    state: State<'_, AppState>,
    mac: String,
) -> Result<(), String> {
    let presence = state.presence.clone();
    tauri::async_runtime::spawn_blocking(move || match presence.as_ref() {
        Some(p) => p.forget(&mac),
        None => Err("presence db unavailable".into()),
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---- Keystore -------------------------------------------------------------
//
// Presence + write-only surface. The raw secret NEVER returns to the
// frontend — outbound requests that need a key are made from Rust, with the
// key fetched via `Keystore::read_key` at request time.

#[tauri::command]
async fn keystore_status(state: State<'_, AppState>) -> Result<Vec<KeyStatus>, String> {
    let ks = state.keystore.clone();
    tauri::async_runtime::spawn_blocking(move || ks.status_all())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn keystore_write(
    state: State<'_, AppState>,
    provider: KeyProvider,
    value: String,
) -> Result<(), String> {
    let ks = state.keystore.clone();
    tauri::async_runtime::spawn_blocking(move || ks.write_key(provider, &value))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

// ---- Domain Intel ---------------------------------------------------------
//
// Passive OSINT — WHOIS/RDAP + DNS + Certificate Transparency in one call.
// The three providers run in parallel; a failure in one doesn't abort the
// others. Each `Finding` is serialized straight through to the frontend.

use raspberry_osint_domain::{
    ct_logs::CtLogsProvider, dns::DnsProvider, rdap::RdapProvider, DomainProvider, Finding,
};

#[derive(serde::Serialize)]
struct DomainIntelReport {
    domain: String,
    findings: Vec<Finding>,
    errors: Vec<String>,
}

#[tauri::command]
async fn domain_intel(domain: String) -> Result<DomainIntelReport, String> {
    let d = domain.trim().to_string();
    if d.is_empty() {
        return Err("domain is empty".into());
    }

    let dns = DnsProvider::new();
    let rdap = RdapProvider::new();
    let ct = CtLogsProvider::new();

    let (r_dns, r_rdap, r_ct) = tokio::join!(
        dns.lookup(&d),
        rdap.lookup(&d),
        ct.lookup(&d),
    );

    let mut findings = Vec::new();
    let mut errors = Vec::new();

    match r_dns {
        Ok(mut f) => findings.append(&mut f),
        Err(e) => errors.push(format!("dns: {e}")),
    }
    match r_rdap {
        Ok(mut f) => findings.append(&mut f),
        Err(e) => errors.push(format!("rdap: {e}")),
    }
    match r_ct {
        Ok(mut f) => findings.append(&mut f),
        Err(e) => errors.push(format!("ct-logs: {e}")),
    }

    Ok(DomainIntelReport { domain: d, findings, errors })
}

/// Background auto-rescan. Runs immediately at startup, then every 5 minutes.
/// Best-effort: any failure is logged and swallowed so the loop keeps ticking.
fn spawn_presence_scanner(presence: Arc<Option<Presence>>) {
    if presence.is_none() {
        eprintln!("[presence] db unavailable; auto-rescan disabled");
        return;
    }
    tauri::async_runtime::spawn(async move {
        let period = std::time::Duration::from_secs(300);
        loop {
            let p = presence.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || {
                let devices = scan_lan_deep();
                if let Some(db) = p.as_ref() {
                    match db.record_scan(&devices) {
                        Ok(new_macs) if !new_macs.is_empty() => {
                            eprintln!(
                                "[presence] {} device(s) seen for the first time",
                                new_macs.len()
                            );
                        }
                        Ok(_) => {}
                        Err(e) => eprintln!("[presence] record_scan failed: {e}"),
                    }
                }
            })
            .await;
            tokio::time::sleep(period).await;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let presence = match Presence::open_default() {
        Ok(p) => Arc::new(Some(p)),
        Err(e) => {
            eprintln!("[presence] could not open DB: {e}");
            Arc::new(None)
        }
    };
    let presence_for_scanner = presence.clone();

    tauri::Builder::default()
        .setup(move |_app| {
            spawn_presence_scanner(presence_for_scanner.clone());
            Ok(())
        })
        .manage(AppState {
            monitor: Arc::new(Mutex::new(Monitor::new())),
            presence,
            keystore: Arc::new(Keystore::new()),
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
            presence_devices,
            presence_sightings,
            presence_rescan,
            presence_set_tag,
            presence_set_alert,
            presence_forget,
            domain_intel,
            keystore_status,
            keystore_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Raspberry Hub window");
}

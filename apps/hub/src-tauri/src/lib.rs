//! Raspberry Hub — Rust entry point and local `Target` (spec §12).
//!
//! Phase 2 exposes the shared `core` crate to the frontend as Tauri commands.
//! The React side calls these via `invoke(...)` (LocalTarget). A future
//! RemoteTarget will send the same shapes over the wire to an Agent.

mod terminal;

use std::sync::Mutex;

use raspberry_core::{
    home_dir, list_dir, list_roots, FileEntry, LanDevice, Monitor, NetworkInfo, ProcessInfo,
    SystemSnapshot,
};
use tauri::State;
use terminal::Terminals;

/// App-wide state. The `Monitor` is locked per call so successive snapshots
/// compute correct CPU / network deltas.
struct AppState {
    monitor: Mutex<Monitor>,
}

#[tauri::command]
fn system_snapshot(state: State<'_, AppState>) -> SystemSnapshot {
    state
        .monitor
        .lock()
        .expect("monitor mutex poisoned")
        .snapshot()
}

#[tauri::command]
fn process_list(state: State<'_, AppState>) -> Vec<ProcessInfo> {
    state
        .monitor
        .lock()
        .expect("monitor mutex poisoned")
        .processes()
}

/// Destructive: kill a process by pid. The frontend confirms before calling.
#[tauri::command]
fn process_kill(state: State<'_, AppState>, pid: u32) -> bool {
    state
        .monitor
        .lock()
        .expect("monitor mutex poisoned")
        .kill(pid)
}

#[tauri::command]
fn files_list(path: String) -> Result<Vec<FileEntry>, String> {
    list_dir(&path)
}

#[tauri::command]
fn files_home() -> String {
    home_dir()
}

#[tauri::command]
fn files_roots() -> Vec<String> {
    list_roots()
}

#[tauri::command]
fn network_info() -> NetworkInfo {
    raspberry_core::network_info()
}

#[tauri::command]
fn network_scan() -> Vec<LanDevice> {
    raspberry_core::scan_lan()
}

/// Send a Wake-on-LAN magic packet. State-changing but LAN-local and harmless
/// (worst case: nothing wakes); the frontend still confirms before calling.
#[tauri::command]
fn wake_on_lan(mac: String) -> Result<(), String> {
    raspberry_core::wake_on_lan(&mac)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            monitor: Mutex::new(Monitor::new()),
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
            wake_on_lan,
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Raspberry Hub window");
}

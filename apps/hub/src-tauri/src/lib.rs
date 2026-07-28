/// Raspberry Hub — Rust entry point.
///
/// Phase 1 is a pure shell: this just opens the frameless matte-black window and
/// loads the React frontend. Phase 2 wires the `core` crate (sysinfo, process,
/// files, power, net) in here behind Tauri commands / a `LocalTarget`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Raspberry Hub window");
}

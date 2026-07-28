use serde::Serialize;
use sysinfo::{Pid, System};

/// A single process row for the Process Explorer.
#[derive(Serialize, Clone, Debug)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent: Option<u32>,
    pub name: String,
    /// CPU usage percent (can exceed 100 across multiple cores).
    pub cpu: f32,
    pub mem_bytes: u64,
    pub status: String,
}

/// Snapshot the current process table. Assumes the caller already refreshed
/// processes (twice, spaced out) so CPU deltas are meaningful.
pub fn list_processes(sys: &System) -> Vec<ProcessInfo> {
    sys.processes()
        .values()
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            parent: p.parent().map(|pp| pp.as_u32()),
            name: p.name().to_string_lossy().to_string(),
            cpu: p.cpu_usage(),
            mem_bytes: p.memory(),
            status: format!("{:?}", p.status()),
        })
        .collect()
}

/// Attempt to kill a process by pid. Returns true if the signal was sent.
/// Destructive — the caller (Tauri command) is responsible for confirmation.
pub fn kill_process(sys: &mut System, pid: u32) -> bool {
    match sys.process(Pid::from_u32(pid)) {
        Some(p) => p.kill(),
        None => false,
    }
}

//! Raspberry shared core — the machine-access layer reused by the Hub (locally)
//! and, in later phases, the Agent (remotely). Phase 2 covers live system stats,
//! the process table, and file browsing against the local machine.

mod files;
mod process;
mod stats;

pub use files::{list_dir, list_roots, home_dir, FileEntry};
pub use process::{kill_process, list_processes, ProcessInfo};
pub use stats::{CpuCore, DiskInfo, SystemSnapshot};

use std::time::Instant;
use sysinfo::{Disks, Networks, ProcessesToUpdate, System};

/// Holds the sampling state needed to compute rates (CPU %, network throughput)
/// between calls. One `Monitor` is kept alive for the app's lifetime and locked
/// per request, so successive snapshots produce meaningful deltas.
pub struct Monitor {
    sys: System,
    networks: Networks,
    last_net: Instant,
}

impl Default for Monitor {
    fn default() -> Self {
        Self::new()
    }
}

impl Monitor {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Monitor {
            sys,
            networks: Networks::new_with_refreshed_list(),
            last_net: Instant::now(),
        }
    }

    /// A fresh resource snapshot. Refreshes CPU, memory, and network, then
    /// reads disks. Network counters are converted to bytes-per-second using
    /// the time elapsed since the previous call.
    pub fn snapshot(&mut self) -> SystemSnapshot {
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();

        // Network deltas since the last snapshot.
        self.networks.refresh(true);
        let elapsed = self.last_net.elapsed().as_secs_f64().max(0.001);
        self.last_net = Instant::now();
        let (mut rx, mut tx) = (0u64, 0u64);
        for (_name, data) in self.networks.iter() {
            rx += data.received();
            tx += data.transmitted();
        }

        let cores: Vec<CpuCore> = self
            .sys
            .cpus()
            .iter()
            .map(|c| CpuCore {
                name: c.name().to_string(),
                usage: c.cpu_usage(),
                freq_mhz: c.frequency(),
            })
            .collect();

        let cpu_name = self
            .sys
            .cpus()
            .first()
            .map(|c| c.brand().trim().to_string())
            .unwrap_or_default();

        let disks = Disks::new_with_refreshed_list()
            .iter()
            .map(|d| DiskInfo {
                name: d.name().to_string_lossy().to_string(),
                mount: d.mount_point().to_string_lossy().to_string(),
                total: d.total_space(),
                available: d.available_space(),
            })
            .collect();

        SystemSnapshot {
            cpu_usage: self.sys.global_cpu_usage(),
            cpu_name,
            cores,
            mem_total: self.sys.total_memory(),
            mem_used: self.sys.used_memory(),
            swap_total: self.sys.total_swap(),
            swap_used: self.sys.used_swap(),
            net_rx_per_s: rx as f64 / elapsed,
            net_tx_per_s: tx as f64 / elapsed,
            disks,
            uptime_secs: System::uptime(),
            host_name: System::host_name().unwrap_or_default(),
            os_long: System::long_os_version().unwrap_or_default(),
            process_count: self.sys.processes().len(),
        }
    }

    /// Refresh and return the process table. Refreshing twice (here and on the
    /// previous call) is what gives sysinfo real per-process CPU numbers.
    pub fn processes(&mut self) -> Vec<ProcessInfo> {
        self.sys
            .refresh_processes(ProcessesToUpdate::All, true);
        list_processes(&self.sys)
    }

    /// Kill a process by pid. Returns true if the signal was delivered.
    pub fn kill(&mut self, pid: u32) -> bool {
        self.sys.refresh_processes(ProcessesToUpdate::All, true);
        kill_process(&mut self.sys, pid)
    }
}

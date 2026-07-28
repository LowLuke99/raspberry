use serde::Serialize;

/// One CPU core's live usage.
#[derive(Serialize, Clone, Debug)]
pub struct CpuCore {
    pub name: String,
    pub usage: f32,
    pub freq_mhz: u64,
}

/// A mounted disk / volume.
#[derive(Serialize, Clone, Debug)]
pub struct DiskInfo {
    pub name: String,
    pub mount: String,
    pub total: u64,
    pub available: u64,
}

/// A full point-in-time snapshot of the machine's resources.
/// Byte counts are raw bytes; the frontend formats them.
#[derive(Serialize, Clone, Debug)]
pub struct SystemSnapshot {
    pub cpu_usage: f32,
    pub cpu_name: String,
    pub cores: Vec<CpuCore>,
    pub mem_total: u64,
    pub mem_used: u64,
    pub swap_total: u64,
    pub swap_used: u64,
    /// Aggregate network throughput since the previous snapshot, per second.
    pub net_rx_per_s: f64,
    pub net_tx_per_s: f64,
    pub disks: Vec<DiskInfo>,
    pub uptime_secs: u64,
    pub host_name: String,
    pub os_long: String,
    pub process_count: usize,
}

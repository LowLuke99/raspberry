/**
 * The transport abstraction (spec §12). Every module talks to a `Target` and
 * neither knows nor cares whether it's the local machine or an agent across the
 * room. Phase 2 ships LocalTarget (Tauri invoke) + MockTarget (browser preview);
 * Phase 5 adds RemoteTarget (mTLS WebSocket) behind the same interface.
 *
 * Shapes mirror the Rust `core` structs (crates/core) exactly.
 */

export interface CpuCore {
  name: string;
  usage: number;
  freq_mhz: number;
}

export interface DiskInfo {
  name: string;
  mount: string;
  total: number;
  available: number;
}

export interface SystemSnapshot {
  cpu_usage: number;
  cpu_name: string;
  cores: CpuCore[];
  mem_total: number;
  mem_used: number;
  swap_total: number;
  swap_used: number;
  net_rx_per_s: number;
  net_tx_per_s: number;
  disks: DiskInfo[];
  uptime_secs: number;
  host_name: string;
  os_long: string;
  process_count: number;
}

export interface ProcessInfo {
  pid: number;
  parent: number | null;
  name: string;
  cpu: number;
  mem_bytes: number;
  status: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number | null;
}

export interface NetInterface {
  name: string;
  friendly: string;
  mac: string | null;
  ipv4: string[];
  is_up: boolean;
}

export interface NetworkInfo {
  interfaces: NetInterface[];
  local_ip: string | null;
  gateway_ip: string | null;
  gateway_mac: string | null;
}

export interface LanDevice {
  ip: string;
  mac: string;
  vendor: string;
  kind: string;
  /** Reverse-DNS / NetBIOS name, only populated by `scanLanDeep`. */
  hostname: string | null;
  /** Ping RTT in ms from the deep scan; null for the fast ARP-only scan. */
  latency_ms: number | null;
}

export interface PhysicalDisk {
  friendly_name: string;
  model: string;
  media_type: string;
  bus_type: string;
  size_bytes: number;
  health: string;
  operational_status: string;
  serial: string;
}

export interface DefenderStatus {
  enabled: boolean;
  realtime: boolean;
  tamper_protection: boolean;
  signature_age_days: number;
  last_full_scan_days: number;
  last_quick_scan_days: number;
  engine_version: string;
}

export interface FirewallProfile {
  name: string;
  enabled: boolean;
  default_inbound: string;
  default_outbound: string;
}

export interface BitlockerVolume {
  mount: string;
  protection_status: string;
  encryption_percent: number;
  volume_status: string;
}

export interface HotFix {
  id: string;
  description: string;
  installed_on: string;
}

export interface SecuritySnapshot {
  defender: DefenderStatus;
  firewall: FirewallProfile[];
  bitlocker: BitlockerVolume[];
  hotfixes: HotFix[];
  uac_level: number | null;
  warnings: string[];
}

export interface LogEvent {
  log: string;
  time: string;
  level: string;
  id: number;
  provider: string;
  message: string;
}

export interface Package {
  id: string;
  name: string;
  version: string;
  /** Only set on upgradable list — the version winget would install. */
  available: string | null;
  source: string;
}

export interface PackageActionResult {
  ok: boolean;
  exit_code: number;
  /** Combined stdout+stderr, trimmed. */
  log: string;
}

export interface SysinfoRow {
  key: string;
  value: string;
}

export interface SysinfoCard {
  available: boolean;
  version: string | null;
  rows: SysinfoRow[];
  raw_json: string;
  /** Set when fastfetch is missing — the winget install one-liner. */
  install_hint: string | null;
}

/**
 * One row of the Watchtower live connection radar (spec §10, Watchtower).
 * Mirrors `raspberry_core::NetConnection`.
 */
export interface NetConnection {
  protocol: string;
  local_addr: string;
  local_port: number;
  remote_addr: string;
  remote_port: number;
  state: string;
  listen_any: boolean;
  foreign: boolean;
  pid: number;
  process_name: string;
  process_path: string | null;
}

export interface ConnectionSnapshot {
  connections: NetConnection[];
  total: number;
  listening: number;
  established: number;
  foreign_hosts: number;
  unique_processes: number;
  /** false on non-Windows targets — the panel shows a "not supported" state. */
  supported: boolean;
}

export interface Target {
  /** True for a real machine (Tauri), false for the mock browser preview. */
  readonly isLive: boolean;
  systemSnapshot(): Promise<SystemSnapshot>;
  processList(): Promise<ProcessInfo[]>;
  killProcess(pid: number): Promise<boolean>;
  listDir(path: string): Promise<FileEntry[]>;
  homeDir(): Promise<string>;
  roots(): Promise<string[]>;
  networkInfo(): Promise<NetworkInfo>;
  scanLan(): Promise<LanDevice[]>;
  scanLanDeep(): Promise<LanDevice[]>;
  wakeOnLan(mac: string): Promise<void>;
  storageDisks(): Promise<PhysicalDisk[]>;
  securityStatus(): Promise<SecuritySnapshot>;
  logsRead(log: string, max: number): Promise<LogEvent[]>;
  // --- Phase 7 ---
  packagesList(): Promise<Package[]>;
  packagesUpgradable(): Promise<Package[]>;
  packagesSearch(query: string): Promise<Package[]>;
  packageInstall(id: string): Promise<PackageActionResult>;
  packageUninstall(id: string): Promise<PackageActionResult>;
  packageUpgrade(id: string): Promise<PackageActionResult>;
  packagesUpgradeAll(): Promise<PackageActionResult>;
  sysinfoCard(): Promise<SysinfoCard>;
  networkConnections(): Promise<ConnectionSnapshot>;
}

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
  wakeOnLan(mac: string): Promise<void>;
}

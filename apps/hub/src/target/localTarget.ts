import { invoke } from "@tauri-apps/api/core";
import type {
  FileEntry,
  LanDevice,
  LogEvent,
  NetworkInfo,
  PhysicalDisk,
  ProcessInfo,
  SecuritySnapshot,
  SystemSnapshot,
  Target,
} from "./types";

/**
 * LocalTarget — drives the local machine through the Rust `core` crate via
 * Tauri commands. Command names + arg keys must match `src-tauri/src/lib.rs`.
 * Importing this module is safe in a browser; `invoke` only touches Tauri when
 * actually called (which only happens when isTauri() selected this target).
 */
export const localTarget: Target = {
  isLive: true,
  systemSnapshot: () => invoke<SystemSnapshot>("system_snapshot"),
  processList: () => invoke<ProcessInfo[]>("process_list"),
  killProcess: (pid) => invoke<boolean>("process_kill", { pid }),
  listDir: (path) => invoke<FileEntry[]>("files_list", { path }),
  homeDir: () => invoke<string>("files_home"),
  roots: () => invoke<string[]>("files_roots"),
  networkInfo: () => invoke<NetworkInfo>("network_info"),
  scanLan: () => invoke<LanDevice[]>("network_scan"),
  wakeOnLan: (mac) => invoke<void>("wake_on_lan", { mac }),
  storageDisks: () => invoke<PhysicalDisk[]>("storage_disks"),
  securityStatus: () => invoke<SecuritySnapshot>("security_status"),
  logsRead: (log, max) => invoke<LogEvent[]>("logs_read", { log, max }),
};

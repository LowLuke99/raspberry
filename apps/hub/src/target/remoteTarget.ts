import type {
  ConnectionSnapshot,
  FileEntry,
  LanDevice,
  LogEvent,
  NetworkInfo,
  Package,
  PhysicalDisk,
  ProcessInfo,
  SecuritySnapshot,
  SysinfoCard,
  SystemSnapshot,
  Target,
} from "./types";

/**
 * RemoteTarget — drives a Raspberry Agent (apps/agent) over HTTP + bearer
 * token. Endpoint shapes match the Rust `core` structs exactly, so the JSON
 * decodes straight into the interfaces the panels already know.
 *
 * v0.1 is read-only. `killProcess` and `wakeOnLan` throw on remote targets
 * because the agent intentionally does not expose them yet — those land after
 * mTLS + per-command allowlisting.
 */
export interface RemoteAgentConn {
  baseUrl: string;
  token: string;
}

export function createRemoteTarget({ baseUrl, token }: RemoteAgentConn): Target {
  const base = baseUrl.replace(/\/+$/, "");
  const headers = { Authorization: `Bearer ${token}` };

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`Agent ${path}: ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  }
  async function post<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, { method: "POST", headers });
    if (!res.ok) throw new Error(`Agent ${path}: ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  }

  const notSupported = (op: string) => {
    throw new Error(`Remote agents don't expose ${op} yet (read-only in v0.1).`);
  };

  return {
    isLive: true,
    systemSnapshot: () => get<SystemSnapshot>("/snapshot"),
    processList: () => get<ProcessInfo[]>("/processes"),
    killProcess: () => Promise.reject(notSupported("killProcess")),
    listDir: (path) =>
      get<FileEntry[]>(`/files_list?path=${encodeURIComponent(path)}`),
    homeDir: () => get<string>("/files_home"),
    roots: () => get<string[]>("/files_roots"),
    networkInfo: () => get<NetworkInfo>("/network_info"),
    scanLan: () => get<LanDevice[]>("/network_scan"),
    scanLanDeep: () => post<LanDevice[]>("/network_scan_deep"),
    wakeOnLan: () => Promise.reject(notSupported("wakeOnLan")),
    storageDisks: () => get<PhysicalDisk[]>("/storage_disks"),
    securityStatus: () => get<SecuritySnapshot>("/security_status"),
    logsRead: (log, max) =>
      get<LogEvent[]>(`/logs/${encodeURIComponent(log)}/${max}`),
    packagesList: () => get<Package[]>("/packages/list"),
    packagesUpgradable: () => get<Package[]>("/packages/upgradable"),
    packagesSearch: (q) =>
      get<Package[]>(`/packages/search?q=${encodeURIComponent(q)}`),
    packageInstall: () => Promise.reject(notSupported("packageInstall")),
    packageUninstall: () => Promise.reject(notSupported("packageUninstall")),
    packageUpgrade: () => Promise.reject(notSupported("packageUpgrade")),
    packagesUpgradeAll: () => Promise.reject(notSupported("packagesUpgradeAll")),
    sysinfoCard: () => get<SysinfoCard>("/sysinfo_card"),
    networkConnections: () => get<ConnectionSnapshot>("/network_connections"),
  };
}

/** Lightweight probe (no auth) — used by the Add Machine flow to confirm the
 *  agent is reachable and to pull its self-reported hostname/version. */
export interface AgentHealth {
  hostname: string;
  version: string;
  os: string;
  unauthenticated: boolean;
}

export async function probeAgent(baseUrl: string): Promise<AgentHealth> {
  const base = baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/health`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Probe failed: ${res.status}`);
  return (await res.json()) as AgentHealth;
}

import type {
  ConnectionSnapshot,
  FileEntry,
  LanDevice,
  LogEvent,
  NetConnection,
  NetworkInfo,
  Package,
  PackageActionResult,
  PhysicalDisk,
  ProcessInfo,
  SecuritySnapshot,
  SysinfoCard,
  SystemSnapshot,
  Target,
} from "./types";

/**
 * MockTarget — believable, gently-wandering fake data so the browser preview
 * (`npm run dev`, no Tauri) stays fully interactive. The native app uses
 * LocalTarget instead. Values drift via a random walk so the live charts move.
 */

const GB = 1024 ** 3;

function walk(current: number, min: number, max: number, step: number): number {
  const next = current + (Math.random() - 0.5) * step;
  return Math.max(min, Math.min(max, next));
}

let cpu = 18;
let memUsed = 11.4 * GB;
const coreUsage = Array.from({ length: 8 }, () => 15 + Math.random() * 20);

let mockProcesses: ProcessInfo[] = [
  ["chrome.exe", 12.4, 1_820], ["Code.exe", 8.1, 940], ["raspberry-hub.exe", 3.2, 180],
  ["explorer.exe", 1.1, 210], ["Discord.exe", 2.4, 410], ["steam.exe", 0.8, 320],
  ["node.exe", 6.6, 260], ["Spotify.exe", 1.9, 190], ["pwsh.exe", 0.5, 90],
  ["dwm.exe", 1.4, 140], ["MsMpEng.exe", 4.0, 300], ["OneDrive.exe", 0.6, 120],
  ["svchost.exe", 0.3, 60], ["Taskmgr.exe", 0.9, 70], ["NVIDIA Share.exe", 0.7, 150],
].map(([name, cpuPct, memMb], i) => ({
  pid: 1000 + i * 4,
  parent: name === "explorer.exe" ? null : 1000,
  name: name as string,
  cpu: cpuPct as number,
  mem_bytes: (memMb as number) * 1024 * 1024,
  status: "Run",
}));

const MOCK_PACKAGES: Package[] = [
  { id: "Microsoft.VisualStudioCode", name: "Visual Studio Code", version: "1.94.2", available: null, source: "winget" },
  { id: "Git.Git", name: "Git", version: "2.46.0", available: null, source: "winget" },
  { id: "Mozilla.Firefox", name: "Mozilla Firefox", version: "131.0", available: null, source: "winget" },
  { id: "Discord.Discord", name: "Discord", version: "1.0.9166", available: null, source: "winget" },
  { id: "Valve.Steam", name: "Steam", version: "2.10.91.91", available: null, source: "winget" },
  { id: "OpenJS.NodeJS.LTS", name: "Node.js LTS", version: "20.17.0", available: null, source: "winget" },
  { id: "7zip.7zip", name: "7-Zip", version: "24.07", available: null, source: "winget" },
  { id: "VideoLAN.VLC", name: "VLC media player", version: "3.0.21", available: null, source: "winget" },
];

const MOCK_UPGRADABLE: Package[] = [
  { id: "Microsoft.VisualStudioCode", name: "Visual Studio Code", version: "1.94.2", available: "1.94.3", source: "winget" },
  { id: "Mozilla.Firefox", name: "Mozilla Firefox", version: "131.0", available: "131.0.2", source: "winget" },
  { id: "Discord.Discord", name: "Discord", version: "1.0.9166", available: "1.0.9170", source: "winget" },
];

const MOCK_SEARCH: Package[] = [
  { id: "Fastfetch-cli.Fastfetch", name: "Fastfetch", version: "2.14.0", available: null, source: "winget" },
  { id: "Neovim.Neovim", name: "Neovim", version: "0.10.2", available: null, source: "winget" },
  { id: "sharkdp.bat", name: "bat", version: "0.24.0", available: null, source: "winget" },
  { id: "junegunn.fzf", name: "fzf", version: "0.55.0", available: null, source: "winget" },
  { id: "BurntSushi.ripgrep.MSVC", name: "ripgrep", version: "14.1.1", available: null, source: "winget" },
];

export const mockTarget: Target = {
  isLive: false,

  async systemSnapshot(): Promise<SystemSnapshot> {
    cpu = walk(cpu, 4, 92, 14);
    memUsed = walk(memUsed, 8 * GB, 20 * GB, 0.4 * GB);
    for (let i = 0; i < coreUsage.length; i++) {
      coreUsage[i] = walk(coreUsage[i]!, 2, 100, 22);
    }
    return {
      cpu_usage: cpu,
      cpu_name: "AMD Ryzen 7 5700G (mock)",
      cores: coreUsage.map((usage, i) => ({
        name: `cpu${i}`,
        usage,
        freq_mhz: 3800,
      })),
      mem_total: 32 * GB,
      mem_used: memUsed,
      swap_total: 8 * GB,
      swap_used: 1.2 * GB,
      net_rx_per_s: Math.random() * 3.5 * 1024 * 1024,
      net_tx_per_s: Math.random() * 0.8 * 1024 * 1024,
      disks: [
        { name: "Windows", mount: "C:\\", total: 476 * GB, available: 55 * GB },
        { name: "Data", mount: "D:\\", total: 931 * GB, available: 402 * GB },
      ],
      uptime_secs: 3600 * 27 + 540,
      host_name: "TOWER-01",
      os_long: "Windows 11 Home (mock data)",
      process_count: 231,
    };
  },

  async processList(): Promise<ProcessInfo[]> {
    // jitter so the table feels live
    mockProcesses = mockProcesses.map((p) => ({
      ...p,
      cpu: Math.max(0, walk(p.cpu, 0, 40, 3)),
      mem_bytes: p.mem_bytes + (Math.random() - 0.5) * 8 * 1024 * 1024,
    }));
    return mockProcesses.slice().sort((a, b) => b.cpu - a.cpu);
  },

  async killProcess(pid: number): Promise<boolean> {
    const before = mockProcesses.length;
    mockProcesses = mockProcesses.filter((p) => p.pid !== pid);
    return mockProcesses.length < before;
  },

  async listDir(path: string): Promise<FileEntry[]> {
    const dirs = ["Documents", "Downloads", "Desktop", "Pictures", "Projects"];
    const files = ["notes.md", "budget.xlsx", "screenshot.png", "todo.txt"];
    const sep = path.endsWith("\\") ? "" : "\\";
    return [
      ...dirs.map((name) => ({
        name,
        path: `${path}${sep}${name}`,
        is_dir: true,
        size: 0,
        modified_ms: Date.now() - Math.random() * 6e9,
      })),
      ...files.map((name) => ({
        name,
        path: `${path}${sep}${name}`,
        is_dir: false,
        size: Math.floor(Math.random() * 4_000_000),
        modified_ms: Date.now() - Math.random() * 6e9,
      })),
    ];
  },

  async homeDir(): Promise<string> {
    return "C:\\Users\\luke";
  },

  async roots(): Promise<string[]> {
    return ["C:\\", "D:\\"];
  },

  async networkInfo(): Promise<NetworkInfo> {
    return {
      interfaces: [
        { name: "Ethernet", friendly: "Ethernet", mac: "a4:83:e7:1c:2d:3e", ipv4: ["192.168.1.42"], is_up: true },
        { name: "Wi-Fi", friendly: "Wi-Fi", mac: "b8:27:eb:9a:1f:04", ipv4: ["192.168.1.77"], is_up: true },
        { name: "Loopback", friendly: "Loopback", mac: null, ipv4: ["127.0.0.1"], is_up: true },
      ],
      local_ip: "192.168.1.42",
      gateway_ip: "192.168.1.1",
      gateway_mac: "3c:5a:b4:11:22:33",
    };
  },

  async scanLan(): Promise<LanDevice[]> {
    // Fast scan mirrors what `arp -a` typically returns — a small handful of
    // recently-active hosts, no hostnames, no latency.
    return [
      { ip: "192.168.1.1", mac: "3c:5a:b4:11:22:33", vendor: "Google / Nest", kind: "dynamic", hostname: null, latency_ms: null },
      { ip: "192.168.1.42", mac: "a4:83:e7:1c:2d:3e", vendor: "Apple", kind: "dynamic", hostname: null, latency_ms: null },
      { ip: "192.168.1.90", mac: "dc:a6:32:44:55:66", vendor: "Raspberry Pi", kind: "dynamic", hostname: null, latency_ms: null },
    ];
  },

  async scanLanDeep(): Promise<LanDevice[]> {
    // Deep scan simulates the /24 sweep — more hosts, hostnames + latency.
    await new Promise((r) => setTimeout(r, 1400));
    return [
      { ip: "192.168.1.1", mac: "3c:5a:b4:11:22:33", vendor: "Google / Nest", kind: "dynamic", hostname: "gateway", latency_ms: 1 },
      { ip: "192.168.1.15", mac: "e0:37:17:aa:bb:cc", vendor: "Sonos", kind: "dynamic", hostname: "Sonos-Kitchen", latency_ms: 4 },
      { ip: "192.168.1.42", mac: "a4:83:e7:1c:2d:3e", vendor: "Apple", kind: "dynamic", hostname: "lukes-macbook", latency_ms: 3 },
      { ip: "192.168.1.58", mac: "b8:27:eb:9a:1f:04", vendor: "Raspberry Pi", kind: "dynamic", hostname: "pi-hole", latency_ms: 2 },
      { ip: "192.168.1.77", mac: "00:15:5d:aa:bb:cc", vendor: "Microsoft (Hyper-V)", kind: "dynamic", hostname: "TOWER-01", latency_ms: 0 },
      { ip: "192.168.1.90", mac: "dc:a6:32:44:55:66", vendor: "Raspberry Pi", kind: "dynamic", hostname: "octoprint", latency_ms: 5 },
      { ip: "192.168.1.102", mac: "44:65:0d:11:22:33", vendor: "Amazon", kind: "dynamic", hostname: "echo-living-room", latency_ms: 12 },
      { ip: "192.168.1.150", mac: "b0:a7:37:44:55:66", vendor: "Roku", kind: "dynamic", hostname: "Roku-Bedroom", latency_ms: 9 },
    ];
  },

  async wakeOnLan(_mac: string): Promise<void> {
    return;
  },

  async storageDisks(): Promise<PhysicalDisk[]> {
    return [
      {
        friendly_name: "Samsung SSD 980 PRO 1TB",
        model: "Samsung SSD 980 PRO 1TB",
        media_type: "SSD",
        bus_type: "NVMe",
        size_bytes: 1_000_204_886_016,
        health: "Healthy",
        operational_status: "OK",
        serial: "S6B0NF0R123456A",
      },
      {
        friendly_name: "WDC WD10EZEX-08WN4A0",
        model: "WDC WD10EZEX-08WN4A0",
        media_type: "HDD",
        bus_type: "SATA",
        size_bytes: 1_000_204_886_016,
        health: "Healthy",
        operational_status: "OK",
        serial: "WD-WCC6Y7XX1234",
      },
      {
        friendly_name: "SanDisk Ultra USB",
        model: "SanDisk Ultra USB",
        media_type: "SSD",
        bus_type: "USB",
        size_bytes: 62_914_560_000,
        health: "Healthy",
        operational_status: "OK",
        serial: "4C531001580619103450",
      },
    ];
  },

  async securityStatus(): Promise<SecuritySnapshot> {
    return {
      defender: {
        enabled: true,
        realtime: true,
        tamper_protection: true,
        signature_age_days: 1,
        last_full_scan_days: 4,
        last_quick_scan_days: 0,
        engine_version: "1.1.24080.9 (mock)",
      },
      firewall: [
        { name: "Domain", enabled: true, default_inbound: "Block", default_outbound: "Allow" },
        { name: "Private", enabled: true, default_inbound: "Block", default_outbound: "Allow" },
        { name: "Public", enabled: true, default_inbound: "Block", default_outbound: "Allow" },
      ],
      bitlocker: [
        { mount: "C:", protection_status: "On", encryption_percent: 100, volume_status: "FullyEncrypted" },
      ],
      hotfixes: [
        { id: "KB5041580", description: "Security Update", installed_on: "2026-07-15T00:00:00" },
        { id: "KB5041872", description: "Update", installed_on: "2026-07-10T00:00:00" },
        { id: "KB5040442", description: "Security Update", installed_on: "2026-06-11T00:00:00" },
      ],
      uac_level: 5,
      warnings: [],
    };
  },

  async packagesList(): Promise<Package[]> {
    return MOCK_PACKAGES.map((p) => ({ ...p, available: null }));
  },

  async packagesUpgradable(): Promise<Package[]> {
    return MOCK_UPGRADABLE;
  },

  async packagesSearch(query: string): Promise<Package[]> {
    const q = query.toLowerCase();
    if (!q) return [];
    return MOCK_SEARCH.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q),
    );
  },

  async packageInstall(id: string): Promise<PackageActionResult> {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true, exit_code: 0, log: `[mock] installed ${id}` };
  },

  async packageUninstall(id: string): Promise<PackageActionResult> {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true, exit_code: 0, log: `[mock] uninstalled ${id}` };
  },

  async packageUpgrade(id: string): Promise<PackageActionResult> {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true, exit_code: 0, log: `[mock] upgraded ${id}` };
  },

  async packagesUpgradeAll(): Promise<PackageActionResult> {
    await new Promise((r) => setTimeout(r, 800));
    return { ok: true, exit_code: 0, log: "[mock] all upgrades complete" };
  },

  async sysinfoCard(): Promise<SysinfoCard> {
    return {
      available: true,
      version: "2.14.0 (mock)",
      rows: [
        { key: "OS", value: "Windows 11 Home 24H2 (mock)" },
        { key: "Host", value: "OMEN 25L GT12-1075t" },
        { key: "Kernel", value: "10.0.26200.1234" },
        { key: "Uptime", value: "1d 3h 17m" },
        { key: "Packages", value: "148 (winget), 12 (scoop)" },
        { key: "Shell", value: "pwsh 7.4.5" },
        { key: "Terminal", value: "Windows Terminal 1.20" },
        { key: "WM", value: "DWM" },
        { key: "CPU", value: "AMD Ryzen 7 5700G @ 8C/16T, 3.80 GHz" },
        { key: "GPU", value: "NVIDIA GeForce RTX 4060" },
        { key: "Memory", value: "12.3 GiB / 32 GiB (38%)" },
        { key: "Disk C:", value: "412 GiB / 476 GiB (86%)" },
      ],
      raw_json: "[/* mock fastfetch payload */]",
      install_hint: null,
    };
  },

  async networkConnections(): Promise<ConnectionSnapshot> {
    // A believable connection set — a browser talking to a handful of hosts,
    // a couple of dev tools listening, and some Windows housekeeping.
    const fixed: Array<Omit<NetConnection, "protocol" | "listen_any" | "foreign">> = [
      { local_addr: "0.0.0.0", local_port: 135, remote_addr: "0.0.0.0", remote_port: 0, state: "Listen", pid: 892, process_name: "svchost", process_path: "C:\\Windows\\System32\\svchost.exe" },
      { local_addr: "0.0.0.0", local_port: 445, remote_addr: "0.0.0.0", remote_port: 0, state: "Listen", pid: 4, process_name: "System", process_path: null },
      { local_addr: "0.0.0.0", local_port: 3000, remote_addr: "0.0.0.0", remote_port: 0, state: "Listen", pid: 21044, process_name: "node", process_path: "C:\\Program Files\\nodejs\\node.exe" },
      { local_addr: "0.0.0.0", local_port: 9000, remote_addr: "0.0.0.0", remote_port: 0, state: "Listen", pid: 21044, process_name: "node", process_path: "C:\\Program Files\\nodejs\\node.exe" },
      { local_addr: "192.168.1.42", local_port: 51824, remote_addr: "142.250.190.78", remote_port: 443, state: "Established", pid: 6120, process_name: "chrome", process_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
      { local_addr: "192.168.1.42", local_port: 51825, remote_addr: "162.159.135.234", remote_port: 443, state: "Established", pid: 6120, process_name: "chrome", process_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
      { local_addr: "192.168.1.42", local_port: 51826, remote_addr: "104.16.132.229", remote_port: 443, state: "Established", pid: 6120, process_name: "chrome", process_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
      { local_addr: "192.168.1.42", local_port: 51830, remote_addr: "140.82.121.4", remote_port: 443, state: "Established", pid: 15080, process_name: "Code", process_path: "C:\\Users\\lukep\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe" },
      { local_addr: "192.168.1.42", local_port: 51831, remote_addr: "20.60.31.129", remote_port: 443, state: "Established", pid: 15080, process_name: "Code", process_path: "C:\\Users\\lukep\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe" },
      { local_addr: "192.168.1.42", local_port: 51840, remote_addr: "162.159.129.234", remote_port: 443, state: "Established", pid: 8320, process_name: "Discord", process_path: "C:\\Users\\lukep\\AppData\\Local\\Discord\\app-1.0.9166\\Discord.exe" },
      { local_addr: "192.168.1.42", local_port: 51841, remote_addr: "35.186.224.25", remote_port: 443, state: "Established", pid: 8320, process_name: "Discord", process_path: "C:\\Users\\lukep\\AppData\\Local\\Discord\\app-1.0.9166\\Discord.exe" },
      { local_addr: "192.168.1.42", local_port: 51850, remote_addr: "104.244.42.129", remote_port: 443, state: "Established", pid: 11492, process_name: "Spotify", process_path: null },
      { local_addr: "127.0.0.1", local_port: 6463, remote_addr: "127.0.0.1", remote_port: 51870, state: "Established", pid: 8320, process_name: "Discord", process_path: null },
      { local_addr: "192.168.1.42", local_port: 51900, remote_addr: "40.100.163.130", remote_port: 443, state: "TimeWait", pid: 0, process_name: "", process_path: null },
    ];
    const connections: NetConnection[] = fixed.map((c) => ({
      protocol: "TCP",
      ...c,
      listen_any: c.local_addr === "0.0.0.0" || c.local_addr === "::",
      foreign:
        c.remote_addr.length > 0 &&
        !c.remote_addr.startsWith("127.") &&
        c.remote_addr !== "0.0.0.0" &&
        c.remote_addr !== "::",
    }));
    const foreignHosts = new Set(connections.filter((c) => c.foreign).map((c) => c.remote_addr));
    const pids = new Set(connections.filter((c) => c.pid !== 0).map((c) => c.pid));
    return {
      connections,
      total: connections.length,
      listening: connections.filter((c) => c.state === "Listen").length,
      established: connections.filter((c) => c.state === "Established").length,
      foreign_hosts: foreignHosts.size,
      unique_processes: pids.size,
      supported: true,
    };
  },

  async logsRead(log: string, max: number): Promise<LogEvent[]> {
    const now = Date.now();
    const providers = ["Microsoft-Windows-Kernel-General", "Service Control Manager", "Application Error", "USER32", "WinLogon"];
    const levels = ["Information", "Information", "Information", "Warning", "Error"];
    const messages = [
      "The operating system started at system time",
      "A service was stopped successfully.",
      "The requested operation completed with a status code of 0x0.",
      "Faulting application chrome.exe, version 128.0.0.0 encountered an unexpected error.",
      "System configuration changed. Applying new policy.",
    ];
    const count = Math.min(max, 40);
    return Array.from({ length: count }, (_, i) => ({
      log,
      time: new Date(now - i * 60_000 * (1 + Math.random() * 5)).toISOString(),
      level: levels[i % levels.length]!,
      id: 1000 + (i * 7) % 400,
      provider: providers[i % providers.length]!,
      message: messages[i % messages.length]!,
    }));
  },
};

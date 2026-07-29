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
    return [
      { ip: "192.168.1.1", mac: "3c:5a:b4:11:22:33", vendor: "Google", kind: "dynamic" },
      { ip: "192.168.1.42", mac: "a4:83:e7:1c:2d:3e", vendor: "Apple", kind: "dynamic" },
      { ip: "192.168.1.58", mac: "b8:27:eb:9a:1f:04", vendor: "Raspberry Pi", kind: "dynamic" },
      { ip: "192.168.1.77", mac: "00:15:5d:aa:bb:cc", vendor: "Microsoft (Hyper-V)", kind: "dynamic" },
      { ip: "192.168.1.90", mac: "dc:a6:32:44:55:66", vendor: "Raspberry Pi", kind: "dynamic" },
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

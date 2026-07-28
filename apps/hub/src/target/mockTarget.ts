import type {
  FileEntry,
  ProcessInfo,
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
};

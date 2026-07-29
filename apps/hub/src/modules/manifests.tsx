import {
  LayoutGrid,
  Gauge,
  ListTree,
  Globe,
  Radar,
  SquareTerminal,
  FolderTree,
  HardDrive,
  Wrench,
  Workflow,
  ShieldCheck,
  LineChart,
  ScrollText,
  Terminal as TerminalIcon,
  BookText,
  type LucideIcon,
} from "lucide-react";
import type { ModuleManifest } from "./types";
import { ModulePlaceholder } from "@/ui/ModulePlaceholder";
import { SystemMonitorPanel } from "./system-monitor/SystemMonitorPanel";
import { ProcessExplorerPanel } from "./process-explorer/ProcessExplorerPanel";
import { GraphsPanel } from "./graphs/GraphsPanel";
import { FilesPanel } from "./files/FilesPanel";
import { TerminalPanel } from "./terminal/TerminalPanel";
import { NetworkPanel } from "./network/NetworkPanel";
import { LanManagerPanel } from "./lan-manager/LanManagerPanel";
import { DevToolboxPanel } from "./dev-toolbox/DevToolboxPanel";
import { CommandsPanel } from "./commands/CommandsPanel";
import { StoragePanel } from "./storage/StoragePanel";
import { SecurityPanel } from "./security/SecurityPanel";
import { LogsPanel } from "./logs/LogsPanel";
import { CommandDeckPanel } from "./command-deck/CommandDeckPanel";

/**
 * Factory for a Phase 1 module: a manifest whose panel is the shared
 * placeholder. In later phases a real module ships its own folder
 * (ui/ services/ state/ commands/ manifest.ts per spec §12) and swaps
 * `Component` for its actual panel — nothing else in the shell changes.
 */
function defineModule(input: {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  section?: ModuleManifest["section"];
  keywords?: string[];
  Component?: ModuleManifest["Component"];
}): ModuleManifest {
  return {
    id: input.id,
    label: input.label,
    route: `/${input.id}`,
    icon: input.icon,
    description: input.description,
    section: input.section ?? "core",
    Component: input.Component ?? ModulePlaceholder,
    ...(input.keywords ? { keywords: input.keywords } : {}),
  };
}

/**
 * The Phase 1 module set. Order here is the sidebar order. The Command Deck is
 * pinned to the top (section "deck"); the twelve tools from spec §10 follow.
 */
export const moduleManifests: ModuleManifest[] = [
  defineModule({
    id: "command-deck",
    label: "Command Deck",
    icon: LayoutGrid,
    description: "Live vitals, storage at a glance, jump to any tool.",
    section: "deck",
    keywords: ["fleet", "machines", "grid", "overview", "home", "dashboard"],
    Component: CommandDeckPanel,
  }),
  defineModule({
    id: "terminal",
    label: "Terminal",
    icon: TerminalIcon,
    description: "Tabbed PowerShell / CMD / WSL — real shells.",
    keywords: ["terminal", "shell", "powershell", "cmd", "wsl", "console"],
    Component: TerminalPanel,
  }),
  defineModule({
    id: "commands",
    label: "Commands",
    icon: BookText,
    description: "Windows commands library — click to copy, tap to learn.",
    keywords: [
      "commands",
      "cmd",
      "powershell",
      "cheatsheet",
      "reference",
      "snippets",
      "copy",
      "windows",
    ],
    Component: CommandsPanel,
  }),
  defineModule({
    id: "system-monitor",
    label: "System Monitor",
    icon: Gauge,
    description: "CPU, RAM, disk, network — live.",
    keywords: ["cpu", "gpu", "ram", "temps", "fans", "resources"],
    Component: SystemMonitorPanel,
  }),
  defineModule({
    id: "process-explorer",
    label: "Process Explorer",
    icon: ListTree,
    description: "Process list, resource usage, kill.",
    keywords: ["processes", "kill", "pid", "threads", "priority"],
    Component: ProcessExplorerPanel,
  }),
  defineModule({
    id: "network",
    label: "Network",
    icon: Globe,
    description: "Local IP, gateway, interfaces (MAC + IPv4).",
    keywords: ["ip", "dns", "ping", "traceroute", "bandwidth", "wifi"],
    Component: NetworkPanel,
  }),
  defineModule({
    id: "lan-manager",
    label: "Local Network Manager",
    icon: Radar,
    description: "Discover devices (ARP), vendor lookup, Wake-on-LAN.",
    keywords: ["discover", "devices", "mac", "wol", "map", "oui"],
    Component: LanManagerPanel,
  }),
  defineModule({
    id: "ssh",
    label: "SSH",
    icon: SquareTerminal,
    description: "Saved servers, keys, one-click connect, sessions.",
    keywords: ["ssh", "servers", "keys", "remote", "terminal"],
  }),
  defineModule({
    id: "files",
    label: "Files",
    icon: FolderTree,
    description: "Browse the local tree — folders, sizes, drives.",
    keywords: ["files", "explorer", "rename", "hash", "transfer"],
    Component: FilesPanel,
  }),
  defineModule({
    id: "storage",
    label: "Storage",
    icon: HardDrive,
    description: "Volumes + physical disks — SSD/HDD/USB, health, capacity.",
    keywords: ["disk", "storage", "smart", "volume", "ssd", "hdd", "nvme"],
    Component: StoragePanel,
  }),
  defineModule({
    id: "dev-toolbox",
    label: "Dev Toolbox",
    icon: Wrench,
    description: "JSON, Base64, UUID, SHA-256, timestamp — offline.",
    keywords: ["json", "base64", "uuid", "regex", "diff", "utilities", "hash", "sha256"],
    Component: DevToolboxPanel,
  }),
  defineModule({
    id: "automation",
    label: "Automation",
    icon: Workflow,
    description: "Saved commands, scripts, scheduler, workflow builder.",
    keywords: ["scripts", "macros", "scheduler", "workflow", "tasks"],
  }),
  defineModule({
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    description: "Defender, firewall, BitLocker, UAC, updates — posture score.",
    keywords: ["defender", "firewall", "bitlocker", "audit", "updates", "uac", "posture"],
    Component: SecurityPanel,
  }),
  defineModule({
    id: "graphs",
    label: "Graphs",
    icon: LineChart,
    description: "Live charts — CPU, memory, network.",
    keywords: ["charts", "graphs", "live", "metrics", "overlay"],
    Component: GraphsPanel,
  }),
  defineModule({
    id: "logs",
    label: "Logs",
    icon: ScrollText,
    description: "Windows Event Log — System, Application, Security.",
    keywords: ["logs", "events", "eventvwr", "history", "search", "filter", "winevent"],
    Component: LogsPanel,
  }),
];

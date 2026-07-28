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
  type LucideIcon,
} from "lucide-react";
import type { ModuleManifest } from "./types";
import { ModulePlaceholder } from "@/ui/ModulePlaceholder";
import { SystemMonitorPanel } from "./system-monitor/SystemMonitorPanel";
import { ProcessExplorerPanel } from "./process-explorer/ProcessExplorerPanel";
import { GraphsPanel } from "./graphs/GraphsPanel";
import { FilesPanel } from "./files/FilesPanel";
import { TerminalPanel } from "./terminal/TerminalPanel";

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
    description: "Every machine on your LAN, one glass grid.",
    section: "deck",
    keywords: ["fleet", "machines", "grid", "overview", "home"],
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
    description: "IP, DNS, ping, traceroute, interfaces, bandwidth.",
    keywords: ["ip", "dns", "ping", "traceroute", "bandwidth", "wifi"],
  }),
  defineModule({
    id: "lan-manager",
    label: "Local Network Manager",
    icon: Radar,
    description: "Discover devices, vendor lookup, map, Wake-on-LAN.",
    keywords: ["discover", "devices", "mac", "wol", "map", "oui"],
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
    description: "Treemap, drive usage, SMART health, duplicates.",
    keywords: ["disk", "storage", "smart", "treemap", "duplicates"],
  }),
  defineModule({
    id: "dev-toolbox",
    label: "Dev Toolbox",
    icon: Wrench,
    description: "JSON, Base64, UUID, regex, diff, timestamp tools.",
    keywords: ["json", "base64", "uuid", "regex", "diff", "utilities"],
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
    description: "Defender, firewall, updates, BitLocker, audit score.",
    keywords: ["defender", "firewall", "bitlocker", "audit", "updates"],
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
    description: "Unified viewer — app, event, terminal history.",
    keywords: ["logs", "events", "history", "search", "filter"],
  }),
];

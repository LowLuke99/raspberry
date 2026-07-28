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
  type LucideIcon,
} from "lucide-react";
import type { ModuleManifest } from "./types";
import { ModulePlaceholder } from "@/ui/ModulePlaceholder";

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
}): ModuleManifest {
  return {
    id: input.id,
    label: input.label,
    route: `/${input.id}`,
    icon: input.icon,
    description: input.description,
    section: input.section ?? "core",
    Component: ModulePlaceholder,
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
    id: "system-monitor",
    label: "System Monitor",
    icon: Gauge,
    description: "CPU, GPU, RAM, disk, temps, fans — live.",
    keywords: ["cpu", "gpu", "ram", "temps", "fans", "resources"],
  }),
  defineModule({
    id: "process-explorer",
    label: "Process Explorer",
    icon: ListTree,
    description: "Process tree, resource usage, kill, priority.",
    keywords: ["processes", "kill", "pid", "threads", "priority"],
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
    description: "Tree explorer, preview, hash, batch rename, transfer.",
    keywords: ["files", "explorer", "rename", "hash", "transfer"],
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
    description: "Live charts — CPU, GPU, memory, net, disk, temps.",
    keywords: ["charts", "graphs", "live", "metrics", "overlay"],
  }),
  defineModule({
    id: "logs",
    label: "Logs",
    icon: ScrollText,
    description: "Unified viewer — app, event, terminal history.",
    keywords: ["logs", "events", "history", "search", "filter"],
  }),
];

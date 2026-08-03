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
  Sparkles,
  Send,
  Cpu,
  Fingerprint,
  Package as PackageIcon,
  IdCard,
  RadioTower,
  Ghost,
  type LucideIcon,
} from "lucide-react";
import type {
  ModuleManifest,
  ModuleCategory,
  PluginCapability,
  PluginPermission,
  EntityKind,
  ApiKeyProvider,
} from "./types";
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
import { TweaksPanel } from "./tweaks/TweaksPanel";
import { IdentityPanel } from "./identity/IdentityPanel";
import { KernelInspectorPanel } from "./kernel-inspector/KernelInspectorPanel";
import { LocalSendPanel } from "./localsend/LocalSendPanel";
import { PackagesPanel } from "./packages/PackagesPanel";
import { SysinfoCardPanel } from "./sysinfo-card/SysinfoCardPanel";
import { WatchtowerPanel } from "./watchtower/WatchtowerPanel";
import { PersonasPanel } from "./personas/PersonasPanel";
import { PresencePanel } from "./presence/PresencePanel";
import { DomainIntelPanel } from "./domain-intel/DomainIntelPanel";

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
  // ---- Plugin manifest v2 (optional; unset = defaults preserve v1) --------
  category?: ModuleCategory;
  capabilities?: PluginCapability[];
  permissions?: PluginPermission[];
  dependencies?: string[];
  outputSchema?: EntityKind[];
  inputSchema?: EntityKind[];
  defaultEnabled?: boolean;
  apiKeys?: ApiKeyProvider[];
  active?: boolean;
  version?: string;
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
    ...(input.category ? { category: input.category } : {}),
    ...(input.capabilities ? { capabilities: input.capabilities } : {}),
    ...(input.permissions ? { permissions: input.permissions } : {}),
    ...(input.dependencies ? { dependencies: input.dependencies } : {}),
    ...(input.outputSchema ? { outputSchema: input.outputSchema } : {}),
    ...(input.inputSchema ? { inputSchema: input.inputSchema } : {}),
    ...(input.defaultEnabled !== undefined ? { defaultEnabled: input.defaultEnabled } : {}),
    ...(input.apiKeys ? { apiKeys: input.apiKeys } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.version ? { version: input.version } : {}),
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
    category: "system",
  }),
  defineModule({
    id: "terminal",
    label: "Terminal",
    icon: TerminalIcon,
    description: "Tabbed PowerShell / CMD / WSL — real shells.",
    keywords: ["terminal", "shell", "powershell", "cmd", "wsl", "console"],
    Component: TerminalPanel,
    category: "system",
    permissions: ["shell.execute", "process.spawn"],
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
    category: "utilities",
  }),
  defineModule({
    id: "packages",
    label: "Packages",
    icon: PackageIcon,
    description: "winget frontend — search, install, upgrade, uninstall.",
    keywords: [
      "packages",
      "winget",
      "install",
      "upgrade",
      "uninstall",
      "apps",
      "software",
      "scoop",
    ],
    Component: PackagesPanel,
    category: "system",
    permissions: ["shell.execute", "process.spawn"],
  }),
  defineModule({
    id: "sysinfo-card",
    label: "Sysinfo Card",
    icon: IdCard,
    description: "System identity via fastfetch — OS, CPU, GPU, memory at a glance.",
    keywords: [
      "sysinfo",
      "fastfetch",
      "neofetch",
      "identity",
      "os",
      "cpu",
      "gpu",
      "specs",
      "about",
    ],
    Component: SysinfoCardPanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "tweaks",
    label: "Tweaks",
    icon: Sparkles,
    description: "Install kits + debloat, privacy, perf, fixes, UI (winutil-style).",
    keywords: [
      "tweaks",
      "winutil",
      "debloat",
      "privacy",
      "install",
      "winget",
      "performance",
      "fix",
    ],
    Component: TweaksPanel,
    category: "system",
    capabilities: ["system-control"],
    permissions: ["shell.execute", "registry.write"],
  }),
  defineModule({
    id: "identity",
    label: "Identity",
    icon: Fingerprint,
    description: "OSINT — find accounts by email (Holehe) or username (Sherlock).",
    keywords: [
      "osint",
      "identity",
      "email",
      "username",
      "sherlock",
      "holehe",
      "lookup",
      "accounts",
      "gmail",
    ],
    Component: IdentityPanel,
    category: "identity",
    capabilities: ["entity-lookup", "passive-recon"],
    inputSchema: ["email", "username"],
    outputSchema: ["url", "username"],
    permissions: ["net.outbound", "process.spawn"],
  }),
  defineModule({
    id: "domain-intel",
    label: "Domain Intel",
    icon: Globe,
    description: "Passive domain OSINT — WHOIS/RDAP, DNS, Certificate Transparency in one shot.",
    keywords: [
      "domain",
      "whois",
      "rdap",
      "dns",
      "crt.sh",
      "certificate",
      "subdomain",
      "osint",
      "recon",
      "mx",
      "ns",
      "txt",
    ],
    Component: DomainIntelPanel,
    category: "osint",
    capabilities: ["entity-lookup", "passive-recon"],
    inputSchema: ["domain"],
    outputSchema: ["ip", "subdomain", "domain", "email"],
    permissions: ["net.outbound"],
  }),
  defineModule({
    id: "personas",
    label: "Personas",
    icon: Ghost,
    description: "Synthetic identity generator — names, addresses, cards, UAs. Offline. All fake.",
    keywords: [
      "personas",
      "fake",
      "identity",
      "generator",
      "anonymous",
      "anon",
      "test data",
      "mock",
      "burner",
      "alias",
      "ghost",
      "sockpuppet",
      "user agent",
      "credit card",
    ],
    Component: PersonasPanel,
    category: "identity",
    capabilities: ["automation"],
  }),
  defineModule({
    id: "localsend",
    label: "LocalSend",
    icon: Send,
    description: "LAN file transfer — AirDrop for every OS, no cloud.",
    keywords: ["localsend", "airdrop", "send", "file", "transfer", "lan", "share"],
    Component: LocalSendPanel,
    category: "network",
    permissions: ["net.lan", "fs.read", "fs.write"],
  }),
  defineModule({
    id: "kernel-inspector",
    label: "Kernel Inspector",
    icon: Cpu,
    description: "Deep native inspection — handles, DLLs, TCP, drivers (System Informer).",
    keywords: [
      "systeminformer",
      "process hacker",
      "kernel",
      "handles",
      "drivers",
      "dll",
      "power",
      "advanced",
    ],
    Component: KernelInspectorPanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "system-monitor",
    label: "System Monitor",
    icon: Gauge,
    description: "CPU, RAM, disk, network — live.",
    keywords: ["cpu", "gpu", "ram", "temps", "fans", "resources"],
    Component: SystemMonitorPanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "process-explorer",
    label: "Process Explorer",
    icon: ListTree,
    description: "Process list, resource usage, kill.",
    keywords: ["processes", "kill", "pid", "threads", "priority"],
    Component: ProcessExplorerPanel,
    category: "system",
    capabilities: ["system-inspection", "system-control"],
    permissions: ["process.kill"],
  }),
  defineModule({
    id: "network",
    label: "Network",
    icon: Globe,
    description: "Local IP, gateway, interfaces (MAC + IPv4).",
    keywords: ["ip", "dns", "ping", "traceroute", "bandwidth", "wifi"],
    Component: NetworkPanel,
    category: "network",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "lan-manager",
    label: "Local Network Manager",
    icon: Radar,
    description: "Discover devices (ARP), vendor lookup, Wake-on-LAN.",
    keywords: ["discover", "devices", "mac", "wol", "map", "oui"],
    Component: LanManagerPanel,
    category: "network",
    capabilities: ["active-recon"],
    outputSchema: ["ip"],
    permissions: ["net.lan"],
    active: true,
  }),
  defineModule({
    id: "presence",
    label: "Presence",
    icon: RadioTower,
    description:
      "One terminal to rule them all — every phone, laptop, and IoT thing on your WiFi, remembered.",
    keywords: [
      "presence",
      "history",
      "who's home",
      "phones",
      "iot",
      "alerts",
      "timeline",
      "devices",
      "monitor",
      "lan",
      "wifi",
    ],
    Component: PresencePanel,
    category: "network",
    capabilities: ["passive-recon"],
    outputSchema: ["ip"],
    permissions: ["net.lan"],
  }),
  defineModule({
    id: "ssh",
    label: "SSH",
    icon: SquareTerminal,
    description: "Saved servers, keys, one-click connect, sessions.",
    keywords: ["ssh", "servers", "keys", "remote", "terminal"],
    category: "network",
  }),
  defineModule({
    id: "files",
    label: "Files",
    icon: FolderTree,
    description: "Browse the local tree — folders, sizes, drives.",
    keywords: ["files", "explorer", "rename", "hash", "transfer"],
    Component: FilesPanel,
    category: "utilities",
    permissions: ["fs.read"],
  }),
  defineModule({
    id: "storage",
    label: "Storage",
    icon: HardDrive,
    description: "Volumes + physical disks — SSD/HDD/USB, health, capacity.",
    keywords: ["disk", "storage", "smart", "volume", "ssd", "hdd", "nvme"],
    Component: StoragePanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "dev-toolbox",
    label: "Toolbox",
    icon: Wrench,
    description: "Port check, password gen, WiFi/URL QR, UUID, timestamp — offline.",
    keywords: [
      "toolbox",
      "port check",
      "port scan",
      "tcp",
      "password generator",
      "qr code",
      "wifi qr",
      "share wifi",
      "uuid",
      "timestamp",
      "utilities",
      "unix time",
    ],
    Component: DevToolboxPanel,
    category: "utilities",
  }),
  defineModule({
    id: "automation",
    label: "Automation",
    icon: Workflow,
    description: "Saved commands, scripts, scheduler, workflow builder.",
    keywords: ["scripts", "macros", "scheduler", "workflow", "tasks"],
    category: "automation",
  }),
  defineModule({
    id: "watchtower",
    label: "Watchtower",
    icon: RadioTower,
    description: "Live TCP radar — every process, every socket, foreign hosts flagged.",
    keywords: [
      "watchtower",
      "connections",
      "netstat",
      "tcp",
      "sockets",
      "outbound",
      "phone home",
      "firewall",
      "listen",
      "established",
      "monitor",
      "radar",
      "traffic",
    ],
    Component: WatchtowerPanel,
    category: "network",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    description: "Defender, firewall, BitLocker, UAC, updates — posture score.",
    keywords: ["defender", "firewall", "bitlocker", "audit", "updates", "uac", "posture"],
    Component: SecurityPanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "graphs",
    label: "Graphs",
    icon: LineChart,
    description: "Live charts — CPU, memory, network.",
    keywords: ["charts", "graphs", "live", "metrics", "overlay"],
    Component: GraphsPanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
  defineModule({
    id: "logs",
    label: "Logs",
    icon: ScrollText,
    description: "Windows Event Log — System, Application, Security.",
    keywords: ["logs", "events", "eventvwr", "history", "search", "filter", "winevent"],
    Component: LogsPanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
];

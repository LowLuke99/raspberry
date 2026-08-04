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
  Keyboard,
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
import { HotkeysPanel } from "./hotkeys/HotkeysPanel";
import { SshPanel } from "./ssh/SshPanel";
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
  learnMore?: string;
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
    ...(input.learnMore ? { learnMore: input.learnMore } : {}),
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
    learnMore:
      "Your home screen. Shows what this machine is doing right now — CPU, memory, disk, network — plus quick tiles to jump to any tool without hunting through the sidebar.\n\nStart here after boot to get a pulse on the system before you dive into anything specific.",
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
    learnMore:
      "A real terminal, built in. Open tabs of PowerShell, Command Prompt (cmd), or WSL (Linux-on-Windows) and run whatever you'd run in a normal console — no need to alt-tab to a separate app.\n\nWhen other Raspberry pages have a Run button (Tweaks, Commands), they send the command here so you can review it before pressing Enter.",
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
    learnMore:
      "A searchable library of Windows commands (both cmd and PowerShell) with plain-English descriptions. Click any card to copy — click 'What does this do?' to read what it actually does before running it.\n\nGood for learning the shell without memorizing man pages, and for grabbing that one command you always forget.",
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
    learnMore:
      "A visual frontend for winget — Microsoft's built-in app installer. See everything installed on this machine, spot upgrades in one click, search a huge catalog, and install / uninstall without a browser.\n\nIt's like the Microsoft Store, but wider (real developer tools, no ads, no signing in) and it works from a real package database instead of a curated storefront.",
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
    learnMore:
      "A one-page 'business card' for this machine — OS build, CPU, GPU, RAM, motherboard, uptime — powered by the fastfetch tool that Linux folks use to flex specs online.\n\nUseful when someone asks 'what are you running?' or when you need to paste your system specs into a bug report.",
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
    learnMore:
      "A curated catalog of Windows tweaks — one-shot 'install kits' (like 'set up a new dev machine' or 'gamer starter pack'), plus debloat (kick out things you don't want), privacy hardening, perf tuning, common fixes, and UI restore-to-sanity commands.\n\nInspired by ChrisTitusTech/winutil, but nothing runs unattended — every tweak is copy-first, and Run pastes into the Terminal without pressing Enter for you so you can read what it's about to do.",
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
    learnMore:
      "OSINT (Open-Source Intelligence) for a person. Give it an email address or username and it checks hundreds of public sites to see where an account by that name exists — using two well-known tools: Holehe (for emails) and Sherlock (for usernames).\n\nUseful for: 'do I still have accounts I forgot about?', reclaiming your handle across services, or investigative work. Only touches public sites; no logins, no scraping past what a person could see with a browser.",
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
    learnMore:
      "Type in a domain (like example.com) and get the full public dossier in one shot: who registered it (WHOIS/RDAP), where it points (DNS records — A, MX, TXT, NS), and every SSL certificate ever issued for it (via Certificate Transparency logs — this is how you discover subdomains without scanning).\n\nAll data is 100% passive — Raspberry never touches the target's servers, only public databases. Safe to run on anyone's domain.",
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
    id: "hotkeys",
    label: "Hotkeys",
    icon: Keyboard,
    description: "Searchable cheatsheet — Windows, Explorer, browser, VS Code, Terminal, PowerToys.",
    learnMore:
      "Every keyboard shortcut that matters, in one searchable page. Windows system-wide, File Explorer, browsers, VS Code, Windows Terminal / PowerShell, PowerToys, gaming, and general text editing.\n\nType what you want to do ('screenshot', 'clipboard', 'rename') and it filters down; or pick a category chip. This is the fastest way to stop reaching for the mouse.",
    keywords: [
      "hotkeys",
      "shortcuts",
      "keyboard",
      "cheatsheet",
      "keybinds",
      "win+r",
      "ctrl+shift+esc",
      "clipboard",
      "vs code",
      "powertoys",
      "explorer",
    ],
    Component: HotkeysPanel,
    category: "utilities",
  }),
  defineModule({
    id: "localsend",
    label: "LocalSend",
    icon: Send,
    description: "LAN file transfer — AirDrop for every OS, no cloud.",
    learnMore:
      "AirDrop-style file sending between devices on the same WiFi/LAN — but it works Windows ↔ Mac ↔ Linux ↔ Android ↔ iOS. Nothing goes through the cloud; the file jumps device-to-device.\n\nGreat when you just want to move a photo from your phone to this machine without emailing yourself, or send a build to another laptop across the room.",
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
    learnMore:
      "The advanced version of Task Manager. Powered by System Informer (formerly Process Hacker), it goes past 'what's using CPU' into 'which file handles is this process holding, which DLLs is it loaded from, what network sockets does it own, which kernel drivers are loaded'.\n\nThe first place a real Windows sysadmin looks when something feels wrong but Task Manager isn't detailed enough.",
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
    learnMore:
      "A live pulse of the machine — CPU load, memory pressure, disk I/O, network throughput — refreshed continuously. Same numbers Task Manager shows, but at a glance and without competing with your work for taskbar space.",
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
    learnMore:
      "Every process running on this machine — the executable name, PID, memory, CPU — laid out in a searchable table. Click a row to see details, kill button ends the process.\n\nWhen the fan won't stop spinning, come here first.",
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
    learnMore:
      "The 'what IP am I on right now' page. Shows every network adapter (Ethernet, WiFi, VPN, Hyper-V/WSL virtual switches), the IPv4 address it holds, its MAC (physical address), and the gateway it routes through.\n\nAnswers the classic questions: what's my LAN IP? which adapter is actually online? what's my router?",
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
    learnMore:
      "Scans your LAN for everything currently online — printers, TVs, phones, IoT bulbs, other laptops. Looks up each MAC address against the IEEE vendor database so you know 'oh, that's a Samsung phone' not just a raw address.\n\nAlso does Wake-on-LAN: if a machine's asleep but its WoL is enabled, this can wake it remotely.",
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
    learnMore:
      "LAN Manager takes a snapshot. Presence keeps history — every device that's ever joined your WiFi with a name, first-seen, last-seen, current status (online / away / gone).\n\nAnswers questions like 'is Lauren home?' (her phone came back on the WiFi 4 minutes ago), 'when did that unfamiliar device first show up?', and 'what's actually sitting on my network right now?' — all from your local machine, no router firmware required.",
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
    learnMore:
      "SSH (Secure Shell) is how you open a terminal on another computer — a server, a VPS, a Raspberry Pi on your LAN — as if you were sitting in front of it. Every command you type runs on the other machine.\n\nThis module saves your connections behind nicknames, builds the right ssh command for you, and hands it to the built-in Terminal — you always see the command before it runs. There's also a Keys tab (generate + install SSH keys the modern way) and a Learn SSH tab that explains the whole thing from scratch.",
    keywords: ["ssh", "servers", "keys", "remote", "terminal", "ed25519", "keygen", "known_hosts", "config"],
    Component: SshPanel,
    category: "network",
    permissions: ["shell.execute", "process.spawn", "net.outbound"],
  }),
  defineModule({
    id: "files",
    label: "Files",
    icon: FolderTree,
    description: "Browse the local tree — folders, sizes, drives.",
    learnMore:
      "A quick file browser inside Raspberry — no need to alt-tab to Explorer to peek at a folder or grab a path. Sizes, drive letters, subfolder tree at a glance.",
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
    learnMore:
      "Two views of storage: logical (drive letters — C:, D:, external USB) and physical (the actual SSDs / HDDs / NVMe sticks). Shows capacity, free space, and SMART health so you can spot a drive that's starting to fail before it dies.",
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
    learnMore:
      "A grab bag of small offline utilities: check whether a TCP port is open, generate a strong password, make a QR code (for a URL or your WiFi credentials), spit out a UUID, convert a unix timestamp.\n\nAll purely local — nothing leaves this machine. Same tools you'd Google 'password generator online' for, but without handing your secrets to a random website.",
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
    learnMore:
      "A place to keep the scripts and command combos you run over and over — with a scheduler (like Windows Task Scheduler, but sane) and, in a later phase, a visual workflow builder that chains modules together (e.g. 'every 15 min, scan LAN → alert if a new device appears').",
    keywords: ["scripts", "macros", "scheduler", "workflow", "tasks"],
    category: "automation",
  }),
  defineModule({
    id: "watchtower",
    label: "Watchtower",
    icon: RadioTower,
    description: "Live TCP radar — every process, every socket, foreign hosts flagged.",
    learnMore:
      "The netstat you always wanted. Shows every open TCP connection this machine has right now — the app on your side, the address on the other side, which port, whether it's listening or already talking.\n\nForeign / non-LAN destinations get flagged, so at a glance you can spot 'why is that app talking to a server in another country?' — the paranoid networking view.",
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
    learnMore:
      "A one-page 'how safe is this machine?' summary. Rolls together Microsoft Defender status, Firewall on/off per profile, BitLocker drive encryption state, UAC level, whether Windows Updates are up to date — and turns it into a posture score.\n\nHigher score = fewer easy foot-guns. Useful right after a fresh install to confirm nothing's turned off.",
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
    learnMore:
      "System Monitor as continuous graphs instead of instant numbers. Watch CPU / memory / network over a rolling window — great for spotting a leak, a spike that only happens every 30 seconds, or a background job that pins the CPU.",
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
    learnMore:
      "A friendlier front-end for the Windows Event Log — the thing Event Viewer shows, except searchable and readable. Every system event, application crash, security-relevant login, and driver warning flows through here.\n\nWhen something 'just stopped working', this is often where the actual error message lives.",
    keywords: ["logs", "events", "eventvwr", "history", "search", "filter", "winevent"],
    Component: LogsPanel,
    category: "system",
    capabilities: ["system-inspection"],
  }),
];

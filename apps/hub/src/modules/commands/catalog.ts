/**
 * Windows commands catalog. Curated so the average card is genuinely useful,
 * not a trivia dump. Each entry:
 *  - `command` is what lands on the clipboard verbatim
 *  - `description` explains WHAT it does in a sentence a human would say
 *  - `admin: true` if it needs an elevated shell (right-click → "Run as admin")
 */
export type CommandShell = "cmd" | "ps" | "either";

export type CommandCategory =
  | "system"
  | "network"
  | "process"
  | "storage"
  | "admin"
  | "power"
  | "shortcuts"
  | "nerd";

export interface WinCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  category: CommandCategory;
  shell: CommandShell;
  admin?: boolean;
  tags?: string[];
}

export const CATEGORY_LABEL: Record<CommandCategory, string> = {
  system: "System",
  network: "Network",
  process: "Process",
  storage: "Storage",
  admin: "Admin",
  power: "Power",
  shortcuts: "Shortcuts",
  nerd: "Nerd Stuff",
};

export const COMMANDS: WinCommand[] = [
  // ── System info ─────────────────────────────────────────────────
  {
    id: "systeminfo",
    name: "Full system report",
    command: "systeminfo",
    description:
      "Prints a giant report about this PC: OS build, install date, BIOS, boot time, memory, network cards, patches. Great first thing to run when troubleshooting someone else's machine.",
    category: "system",
    shell: "either",
    tags: ["info", "specs", "build"],
  },
  {
    id: "winver",
    name: "Windows version",
    command: "winver",
    description:
      "Opens the little 'About Windows' popup showing your exact Windows version and build number. The quickest way to tell someone what OS you're on.",
    category: "system",
    shell: "either",
    tags: ["version", "build"],
  },
  {
    id: "dxdiag",
    name: "DirectX diagnostic",
    command: "dxdiag",
    description:
      "Opens the DirectX diagnostic tool — shows GPU, driver versions, display modes, sound devices. Useful when a game or GPU tool is misbehaving.",
    category: "system",
    shell: "either",
    tags: ["gpu", "graphics", "driver"],
  },
  {
    id: "hostname",
    name: "Get this PC's name",
    command: "hostname",
    description: "Prints the computer name — the same one other devices see on the LAN.",
    category: "system",
    shell: "either",
  },
  {
    id: "uptime",
    name: "How long PC has been on",
    command: "(get-date) - (gcim Win32_OperatingSystem).LastBootUpTime",
    description:
      "PowerShell one-liner that prints exact uptime since the last boot (days/hours/minutes/seconds).",
    category: "system",
    shell: "ps",
    tags: ["boot", "uptime"],
  },
  {
    id: "getbios",
    name: "BIOS + motherboard info",
    command: "Get-CimInstance Win32_BIOS; Get-CimInstance Win32_BaseBoard",
    description:
      "Shows BIOS version + motherboard manufacturer/model/serial. Handy when planning a BIOS update or spec-checking a used PC.",
    category: "system",
    shell: "ps",
    tags: ["bios", "motherboard"],
  },

  // ── Network ─────────────────────────────────────────────────────
  {
    id: "ipconfig",
    name: "Show all IP addresses",
    command: "ipconfig /all",
    description:
      "Full IP/DNS report for every network adapter — IPv4, gateway, MAC, DHCP lease, DNS suffixes. The single most-used Windows network command.",
    category: "network",
    shell: "either",
    tags: ["ip", "dns", "mac", "adapter"],
  },
  {
    id: "flushdns",
    name: "Flush DNS cache",
    command: "ipconfig /flushdns",
    description:
      "Wipes the DNS resolver cache. First thing to try when a site you just fixed still won't resolve, or after changing hosts file.",
    category: "network",
    shell: "either",
    tags: ["dns", "cache", "fix"],
  },
  {
    id: "renewdhcp",
    name: "Renew DHCP lease",
    command: "ipconfig /release && ipconfig /renew",
    description:
      "Drops the current DHCP lease and asks the router for a fresh one. Fixes weird 'connected but no internet' states.",
    category: "network",
    shell: "cmd",
    tags: ["dhcp", "renew"],
  },
  {
    id: "ping",
    name: "Ping Google (connectivity test)",
    command: "ping google.com",
    description:
      "Sends 4 ICMP echoes to google.com. If this fails but ping 8.8.8.8 works, your DNS is broken. If both fail, your internet is.",
    category: "network",
    shell: "either",
    tags: ["ping", "test", "icmp"],
  },
  {
    id: "tracert",
    name: "Trace route to a site",
    command: "tracert google.com",
    description:
      "Shows every hop between you and the target. Use this to see where packets are getting dropped — your ISP or beyond it.",
    category: "network",
    shell: "either",
    tags: ["traceroute", "hops"],
  },
  {
    id: "nslookup",
    name: "Look up a domain's IP",
    command: "nslookup google.com",
    description:
      "Queries your configured DNS for a domain's IP. Add a second arg to query a specific DNS server: nslookup google.com 1.1.1.1",
    category: "network",
    shell: "either",
    tags: ["dns"],
  },
  {
    id: "getnetadapter",
    name: "List network adapters (PS)",
    command: "Get-NetAdapter | Format-Table -AutoSize",
    description:
      "PowerShell adapter table — name, status, MAC, link speed. Cleaner than ipconfig for seeing what's up and what's down.",
    category: "network",
    shell: "ps",
  },
  {
    id: "netstat",
    name: "See open connections + ports",
    command: "netstat -ano",
    description:
      "Every active TCP/UDP connection and the PID that owns it. Cross-reference the PID in Task Manager to find what's talking to the internet.",
    category: "network",
    shell: "either",
    tags: ["ports", "pid", "sockets"],
  },
  {
    id: "netstat-listen",
    name: "What's listening on a port?",
    command: "netstat -ano | findstr :3000",
    description:
      "Finds the process listening on port 3000. Swap 3000 for any port you care about. Then run `tasklist /fi \"pid eq 12345\"` to name the process.",
    category: "network",
    shell: "cmd",
    tags: ["port", "listen"],
  },
  {
    id: "arp",
    name: "See who's on the LAN (ARP)",
    command: "arp -a",
    description:
      "Dumps the ARP cache — every device your machine has recently talked to on the LAN, with MAC + IP. Rough LAN discovery, free.",
    category: "network",
    shell: "either",
    tags: ["arp", "lan", "mac", "discover"],
  },
  {
    id: "wifi-pw",
    name: "Show saved Wi-Fi password",
    command:
      'netsh wlan show profile name="YourWifiName" key=clear',
    description:
      "Reveals the password of a Wi-Fi network this PC has connected to before. Replace YourWifiName with the SSID. Under `Security settings` look for `Key Content`.",
    category: "network",
    shell: "either",
    admin: true,
    tags: ["wifi", "password"],
  },
  {
    id: "wifi-profiles",
    name: "List every saved Wi-Fi",
    command: "netsh wlan show profiles",
    description:
      "Lists every Wi-Fi network this PC remembers. Combine with the previous command to recover any of their passwords.",
    category: "network",
    shell: "either",
    tags: ["wifi", "profiles"],
  },
  {
    id: "wifi-report",
    name: "Full Wi-Fi history report",
    command: "netsh wlan show wlanreport",
    description:
      "Generates a beautifully detailed HTML report of Wi-Fi events, disconnects, and signal issues over the last few days. Path is printed at the end — open it in a browser.",
    category: "network",
    shell: "either",
    admin: true,
    tags: ["wifi", "report", "diagnostic"],
  },
  {
    id: "resetnet",
    name: "Full network reset (nuclear)",
    command: "netsh int ip reset && netsh winsock reset",
    description:
      "Resets the TCP/IP stack and Winsock catalog. Use when nothing else fixes the network — after this, reboot. Will forget custom DNS / static IP configs.",
    category: "network",
    shell: "cmd",
    admin: true,
    tags: ["reset", "fix"],
  },

  // ── Processes ───────────────────────────────────────────────────
  {
    id: "tasklist",
    name: "List running processes",
    command: "tasklist",
    description:
      "Table of every running process with PID and memory usage. Add /svc to also see which Windows services each hosts.",
    category: "process",
    shell: "either",
  },
  {
    id: "taskkill-pid",
    name: "Kill a process by PID",
    command: "taskkill /F /PID 12345",
    description:
      "Force-kills the process with PID 12345 (get the PID from tasklist or Task Manager). Use /T to also kill its children.",
    category: "process",
    shell: "either",
    tags: ["kill", "pid"],
  },
  {
    id: "taskkill-name",
    name: "Kill by name (e.g. Chrome)",
    command: "taskkill /F /IM chrome.exe /T",
    description:
      "Force-kills every process named chrome.exe and all its children. Swap chrome.exe for whatever's stuck.",
    category: "process",
    shell: "either",
    tags: ["kill", "process"],
  },
  {
    id: "get-process-cpu",
    name: "Top CPU processes (PS)",
    command: "Get-Process | Sort-Object CPU -Descending | Select -First 10",
    description:
      "Top 10 CPU consumers, ranked. PowerShell version of 'what's eating my CPU'.",
    category: "process",
    shell: "ps",
    tags: ["cpu", "top"],
  },
  {
    id: "get-process-mem",
    name: "Top RAM processes (PS)",
    command: "Get-Process | Sort-Object WS -Descending | Select -First 10 Name, @{n='RAM (MB)';e={[math]::Round($_.WS/1MB,1)}}",
    description:
      "Top 10 processes by working-set memory in MB. Prints as a clean table.",
    category: "process",
    shell: "ps",
    tags: ["ram", "memory", "top"],
  },

  // ── Storage / disk ──────────────────────────────────────────────
  {
    id: "chkdsk",
    name: "Check disk for errors",
    command: "chkdsk C: /F",
    description:
      "Scans the C: drive for filesystem errors and fixes them. On the system drive it'll schedule at next reboot. Add /R to also look for bad sectors (slow).",
    category: "storage",
    shell: "either",
    admin: true,
    tags: ["disk", "repair"],
  },
  {
    id: "sfc",
    name: "Repair Windows system files",
    command: "sfc /scannow",
    description:
      "Scans all protected Windows files and replaces corrupted ones from cache. Run first when Windows starts acting weird after an update.",
    category: "storage",
    shell: "either",
    admin: true,
    tags: ["repair", "system"],
  },
  {
    id: "dism",
    name: "Repair Windows image (DISM)",
    command: "DISM /Online /Cleanup-Image /RestoreHealth",
    description:
      "Repairs the Windows component store using Windows Update as a source. Run this before sfc /scannow if sfc alone can't fix it.",
    category: "storage",
    shell: "either",
    admin: true,
    tags: ["repair", "dism"],
  },
  {
    id: "cleanmgr",
    name: "Open Disk Cleanup",
    command: "cleanmgr /sageset:1",
    description:
      "Launches the classic Disk Cleanup wizard so you can tick what junk to delete (temp files, previous Windows install, etc.).",
    category: "storage",
    shell: "either",
    tags: ["cleanup", "space"],
  },
  {
    id: "wmic-disk",
    name: "List disks + models",
    command: "Get-PhysicalDisk | Format-Table FriendlyName, MediaType, Size, HealthStatus -AutoSize",
    description:
      "Every physical disk: name, SSD/HDD, size, health. Modern replacement for `wmic diskdrive`.",
    category: "storage",
    shell: "ps",
    tags: ["disk", "ssd", "hdd"],
  },
  {
    id: "get-volume",
    name: "Show all volumes",
    command: "Get-Volume",
    description:
      "Table of every mounted volume with drive letter, filesystem, size, and free space.",
    category: "storage",
    shell: "ps",
  },

  // ── Admin / power tools ─────────────────────────────────────────
  {
    id: "gpupdate",
    name: "Refresh group policy",
    command: "gpupdate /force",
    description:
      "Forces Group Policy to re-apply now instead of waiting the usual 90-minute interval. Useful after IT pushes a policy change.",
    category: "admin",
    shell: "either",
    tags: ["gpo", "policy"],
  },
  {
    id: "services",
    name: "Open Services manager",
    command: "services.msc",
    description:
      "Opens the classic Services console — start/stop/disable Windows services.",
    category: "admin",
    shell: "either",
  },
  {
    id: "eventvwr",
    name: "Open Event Viewer",
    command: "eventvwr.msc",
    description:
      "Opens Event Viewer — the big log of everything Windows notices. Application/System logs are where crashes and driver errors show up.",
    category: "admin",
    shell: "either",
    tags: ["logs", "events"],
  },
  {
    id: "taskschd",
    name: "Open Task Scheduler",
    command: "taskschd.msc",
    description: "Opens Task Scheduler — schedule scripts, view what auto-runs, disable noisy tasks.",
    category: "admin",
    shell: "either",
    tags: ["schedule", "cron"],
  },
  {
    id: "regedit",
    name: "Open Registry Editor",
    command: "regedit",
    description:
      "Opens the Registry Editor. Handle with care — wrong edits here can brick features. Always right-click → Export before changing a key.",
    category: "admin",
    shell: "either",
    admin: true,
    tags: ["registry"],
  },
  {
    id: "mmc",
    name: "Open MMC console",
    command: "mmc",
    description: "Opens a blank Microsoft Management Console you can load snap-ins into.",
    category: "admin",
    shell: "either",
  },
  {
    id: "compmgmt",
    name: "Open Computer Management",
    command: "compmgmt.msc",
    description:
      "One-stop console: Device Manager, Disk Management, Users, Services, Event Viewer, Task Scheduler.",
    category: "admin",
    shell: "either",
    tags: ["console", "everything"],
  },
  {
    id: "devmgmt",
    name: "Open Device Manager",
    command: "devmgmt.msc",
    description: "Opens Device Manager to check drivers and hardware states.",
    category: "admin",
    shell: "either",
  },
  {
    id: "diskmgmt",
    name: "Open Disk Management",
    command: "diskmgmt.msc",
    description: "Opens Disk Management — partition, format, assign drive letters.",
    category: "admin",
    shell: "either",
  },
  {
    id: "msconfig",
    name: "Open System Configuration",
    command: "msconfig",
    description:
      "Opens msconfig — boot options, safe mode, services. Use here to enable Safe Boot before a reboot.",
    category: "admin",
    shell: "either",
  },
  {
    id: "control",
    name: "Open Control Panel",
    command: "control",
    description: "Opens the classic Control Panel.",
    category: "shortcuts",
    shell: "either",
  },
  {
    id: "control-userpasswords",
    name: "Open User Accounts (advanced)",
    command: "control userpasswords2",
    description:
      "Opens the classic User Accounts panel — where you toggle 'users must enter a username and password' for auto-login.",
    category: "admin",
    shell: "either",
    tags: ["autologin", "users"],
  },

  // ── Power / shutdown ────────────────────────────────────────────
  {
    id: "shutdown-now",
    name: "Shutdown in 10 seconds",
    command: "shutdown /s /t 10",
    description:
      "Shuts down in 10 seconds. Cancel with shutdown /a. Add /f to force close apps that resist.",
    category: "power",
    shell: "either",
    tags: ["shutdown"],
  },
  {
    id: "reboot-now",
    name: "Restart now",
    command: "shutdown /r /t 0",
    description: "Reboots immediately, no countdown. /f to force close apps first.",
    category: "power",
    shell: "either",
    tags: ["reboot"],
  },
  {
    id: "shutdown-abort",
    name: "Cancel a pending shutdown",
    command: "shutdown /a",
    description: "Aborts a shutdown/restart that's already been scheduled.",
    category: "power",
    shell: "either",
  },
  {
    id: "powercfg-battery",
    name: "Generate battery report",
    command: "powercfg /batteryreport /output C:\\battery-report.html",
    description:
      "Writes a full HTML battery health report to C:\\battery-report.html — capacity over time, cycle history, life estimates. Laptop-only.",
    category: "power",
    shell: "either",
    tags: ["battery", "laptop", "report"],
  },
  {
    id: "powercfg-sleep",
    name: "Why won't my PC sleep?",
    command: "powercfg /requests",
    description:
      "Lists exactly what's currently keeping the PC from sleeping (a driver, an app, an audio stream). Insanely useful.",
    category: "power",
    shell: "either",
    admin: true,
    tags: ["sleep", "wake"],
  },
  {
    id: "powercfg-energy",
    name: "Generate energy diagnostic report",
    command: "powercfg /energy",
    description:
      "Watches the system for 60 seconds then produces an HTML report of everything wasting power or misbehaving.",
    category: "power",
    shell: "either",
    admin: true,
    tags: ["energy", "diagnose"],
  },

  // ── Shortcuts / GUI launchers ───────────────────────────────────
  {
    id: "explorer-startup",
    name: "Open Startup folder",
    command: "shell:startup",
    description:
      "Opens the per-user Startup folder in Explorer. Drop any shortcut in here to have it launch at login.",
    category: "shortcuts",
    shell: "either",
    tags: ["startup", "autostart"],
  },
  {
    id: "explorer-startup-all",
    name: "Open Startup folder (all users)",
    command: "shell:common startup",
    description:
      "Opens the machine-wide Startup folder — anything here launches for every user at login.",
    category: "shortcuts",
    shell: "either",
    admin: true,
    tags: ["startup"],
  },
  {
    id: "sendto",
    name: "Open SendTo folder",
    command: "shell:sendto",
    description:
      "Opens the SendTo folder. Drop a shortcut in here to make it appear in the right-click → Send to menu of every file.",
    category: "shortcuts",
    shell: "either",
    tags: ["contextmenu", "sendto"],
  },
  {
    id: "gods-folder",
    name: "God Mode folder",
    command:
      'powershell -c "New-Item -Path $env:USERPROFILE\\Desktop\\GodMode.{ED7BA470-8E54-465E-825C-99712043E01C} -ItemType Directory"',
    description:
      "Creates a 'God Mode' folder on your Desktop — a single place that lists every Control Panel setting Windows knows about. Nerdy but very handy.",
    category: "shortcuts",
    shell: "either",
    tags: ["godmode", "control"],
  },
  {
    id: "restart-explorer",
    name: "Restart Explorer (taskbar fix)",
    command: "taskkill /F /IM explorer.exe && start explorer.exe",
    description:
      "Kills and restarts the Windows shell (explorer.exe). Fixes a frozen taskbar or a stuck notification area without needing a full reboot.",
    category: "shortcuts",
    shell: "cmd",
    tags: ["taskbar", "fix"],
  },

  // ── Nerd stuff ──────────────────────────────────────────────────
  {
    id: "get-installed-apps",
    name: "List every installed program",
    command:
      "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select DisplayName, DisplayVersion, Publisher | Sort DisplayName",
    description:
      "Reads the uninstall registry keys to list every installed program with version + publisher. Way more complete than Settings → Apps.",
    category: "nerd",
    shell: "ps",
    tags: ["apps", "installed"],
  },
  {
    id: "product-key",
    name: "Show Windows product key",
    command:
      "wmic path softwarelicensingservice get OA3xOriginalProductKey",
    description:
      "Prints the Windows product key stored in the BIOS/UEFI (OEM). Blank output = no OEM key (probably a retail install).",
    category: "nerd",
    shell: "either",
    admin: true,
    tags: ["key", "license"],
  },
  {
    id: "hosts-file",
    name: "Edit the hosts file",
    command: "notepad C:\\Windows\\System32\\drivers\\etc\\hosts",
    description:
      "Opens the hosts file in Notepad. Add lines like `127.0.0.1 example.com` to hard-map domains. Must run Notepad as admin to save.",
    category: "nerd",
    shell: "either",
    admin: true,
    tags: ["hosts", "dns"],
  },
  {
    id: "assoc",
    name: "See what opens .pdf files",
    command: "assoc .pdf && ftype AcroExch.Document.DC",
    description:
      "assoc maps an extension to a filetype name; ftype maps that filetype to the actual program. Swap .pdf and the type name for anything.",
    category: "nerd",
    shell: "cmd",
    tags: ["assoc", "defaults"],
  },
  {
    id: "activation",
    name: "Show Windows activation status",
    command: "slmgr /xpr",
    description:
      "Pops a dialog telling you whether Windows is activated and, if it's a time-limited license, when it expires.",
    category: "nerd",
    shell: "either",
    tags: ["activation"],
  },
  {
    id: "clip",
    name: "Send output to clipboard",
    command: "ipconfig | clip",
    description:
      "Pipe any command's output into the clipboard. Great for pasting logs into a chat: `sfc /scannow | clip`.",
    category: "nerd",
    shell: "cmd",
    tags: ["clipboard", "pipe"],
  },
  {
    id: "where",
    name: "Find an executable on PATH",
    command: "where node",
    description:
      "Prints every location on PATH where `node` is found. Windows' answer to `which`. Swap node for any command.",
    category: "nerd",
    shell: "either",
    tags: ["which", "path"],
  },
];

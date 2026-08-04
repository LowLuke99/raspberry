/**
 * Windows tweaks catalog — inspired by ChrisTitusTech/winutil.
 *  https://github.com/ChrisTitusTech/winutil
 *
 * We DON'T ship winutil's UI or run anything unattended. Each entry is a
 * curated one-liner the user copies (or sends to the built-in Terminal) with
 * the same explicit confirm-before-run pattern as the Commands module.
 * `admin: true` means it needs an elevated shell.
 */
export type TweakShell = "cmd" | "ps" | "either";

export type TweakCategory =
  | "install"
  | "debloat"
  | "privacy"
  | "performance"
  | "fix"
  | "ui";

export interface Tweak {
  id: string;
  name: string;
  command: string;
  description: string;
  category: TweakCategory;
  shell: TweakShell;
  admin?: boolean;
  danger?: "low" | "medium" | "high";
  tags?: string[];
}

export const TWEAK_CATEGORY_LABEL: Record<TweakCategory, string> = {
  install: "Install",
  debloat: "Debloat",
  privacy: "Privacy",
  performance: "Performance",
  fix: "Fixes",
  ui: "UI Tweaks",
};

export const TWEAKS: Tweak[] = [
  // ── Install ─────────────────────────────────────────────────────
  {
    id: "install-essentials",
    name: "Install: Firefox + VLC + 7-Zip + Notepad++",
    command:
      "winget install --id Mozilla.Firefox -e ; winget install --id VideoLAN.VLC -e ; winget install --id 7zip.7zip -e ; winget install --id Notepad++.Notepad++ -e",
    description:
      "One-shot install of the four apps almost every fresh Windows install needs. Uses winget so no unattended installers, no toolbars.",
    category: "install",
    shell: "ps",
    tags: ["winget", "essentials"],
  },
  {
    id: "install-dev-basics",
    name: "Install: Git + PowerShell 7 + Windows Terminal + VS Code",
    command:
      "winget install --id Git.Git -e ; winget install --id Microsoft.PowerShell -e ; winget install --id Microsoft.WindowsTerminal -e ; winget install --id Microsoft.VisualStudioCode -e",
    description:
      "The four things every dev machine needs. All from Microsoft or first-party publishers via winget.",
    category: "install",
    shell: "ps",
    tags: ["winget", "dev"],
  },
  {
    id: "install-brave-discord-steam",
    name: "Install: Brave + Discord + Steam",
    command:
      "winget install --id Brave.Brave -e ; winget install --id Discord.Discord -e ; winget install --id Valve.Steam -e",
    description: "The gamer starter pack.",
    category: "install",
    shell: "ps",
    tags: ["winget", "gaming"],
  },
  {
    id: "install-obs",
    name: "Install: OBS Studio",
    command: "winget install --id OBSProject.OBSStudio -e",
    description: "Streaming + recording. Free, no watermark.",
    category: "install",
    shell: "ps",
    tags: ["winget", "obs"],
  },
  {
    id: "winget-upgrade-all",
    name: "Upgrade every winget-installed app",
    command: "winget upgrade --all --include-unknown --silent",
    description:
      "Runs winget upgrade on every managed app in one shot. Use monthly to keep things patched.",
    category: "install",
    shell: "ps",
    tags: ["winget", "update"],
  },
  {
    id: "install-github-power",
    name: "Kit: GitHub power tools (gh, lazygit, delta, Fork)",
    command:
      "winget install --id GitHub.cli -e ; winget install --id jesseduffield.lazygit -e ; winget install --id dandavison.delta -e ; winget install --id Fork.Fork -e",
    description:
      "gh = GitHub CLI (`gh pr create`, `gh issue list`, `gh copilot suggest`). lazygit = terminal git UI. delta = beautiful diffs. Fork = a great free graphical git client. Every dev's git bag in one.",
    category: "install",
    shell: "ps",
    tags: ["github", "git", "cli", "dev"],
  },
  {
    id: "install-terminal-upgrades",
    name: "Kit: Terminal upgrades (Starship, fzf, ripgrep, bat, zoxide)",
    command:
      "winget install --id Starship.Starship -e ; winget install --id junegunn.fzf -e ; winget install --id BurntSushi.ripgrep.MSVC -e ; winget install --id sharkdp.bat -e ; winget install --id ajeetdsouza.zoxide -e",
    description:
      "Modern shell staples: prettier prompt (starship), fuzzy finder (fzf), fast grep (ripgrep), colorized cat (bat), smarter cd (zoxide). Turns your shell into a much better tool.",
    category: "install",
    shell: "ps",
    tags: ["winget", "cli", "shell"],
  },
  {
    id: "install-dev-runtimes",
    name: "Kit: Dev runtimes (Node LTS, Python, Rust, Go)",
    command:
      "winget install --id OpenJS.NodeJS.LTS -e ; winget install --id Python.Python.3.12 -e ; winget install --id Rustlang.Rustup -e ; winget install --id GoLang.Go -e",
    description:
      "Node, Python, Rust, Go — the four language runtimes 90% of open-source projects want on your machine.",
    category: "install",
    shell: "ps",
    tags: ["winget", "runtime", "node", "python", "rust", "go"],
  },
  {
    id: "install-containers",
    name: "Kit: Containers (Docker Desktop, Podman)",
    command:
      "winget install --id Docker.DockerDesktop -e ; winget install --id RedHat.Podman -e",
    description:
      "Docker Desktop + Podman (the rootless open-source alternative). Requires WSL 2 and virtualization enabled in BIOS.",
    category: "install",
    shell: "ps",
    tags: ["winget", "docker", "podman", "containers"],
  },
  {
    id: "install-ai-dev",
    name: "Kit: AI dev stack (Ollama, LM Studio, Cursor)",
    command:
      "winget install --id Ollama.Ollama -e ; winget install --id ElementLabs.LMStudio -e ; winget install --id Anysphere.Cursor -e",
    description:
      "Ollama = run open models locally. LM Studio = graphical model runner. Cursor = AI-native VS Code fork. Great starter kit for local AI dev.",
    category: "install",
    shell: "ps",
    tags: ["winget", "ai", "llm", "ollama"],
  },
  {
    id: "install-media-creators",
    name: "Kit: Creators (OBS, Handbrake, Audacity, GIMP, Krita, Inkscape, Blender)",
    command:
      "winget install --id OBSProject.OBSStudio -e ; winget install --id HandBrake.HandBrake -e ; winget install --id Audacity.Audacity -e ; winget install --id GIMP.GIMP -e ; winget install --id KDE.Krita -e ; winget install --id Inkscape.Inkscape -e ; winget install --id BlenderFoundation.Blender -e",
    description:
      "Streaming + video (OBS, Handbrake), audio (Audacity), raster + paint (GIMP, Krita), vector (Inkscape), and 3D (Blender). Pro-grade creator suite, free.",
    category: "install",
    shell: "ps",
    tags: ["winget", "creative", "video", "audio", "art"],
  },
  {
    id: "install-media-playback",
    name: "Kit: Better media playback (mpv, VLC, MPC-HC)",
    command:
      "winget install --id mpv.net -e ; winget install --id VideoLAN.VLC -e ; winget install --id clsid2.mpc-hc -e",
    description:
      "mpv = tiny, plays literally everything. VLC = the classic. MPC-HC = the K-Lite-crowd favorite. Grab whichever fits your muscle memory.",
    category: "install",
    shell: "ps",
    tags: ["winget", "video", "media"],
  },
  {
    id: "install-comms",
    name: "Kit: Comms (Discord, Slack, Signal, Telegram, Zoom)",
    command:
      "winget install --id Discord.Discord -e ; winget install --id SlackTechnologies.Slack -e ; winget install --id OpenWhisperSystems.Signal -e ; winget install --id Telegram.TelegramDesktop -e ; winget install --id Zoom.Zoom -e",
    description:
      "The five apps every fresh machine ends up installing anyway. All native, all pinnable, no browser tab treadmill.",
    category: "install",
    shell: "ps",
    tags: ["winget", "chat", "voice"],
  },
  {
    id: "install-security-suite",
    name: "Kit: Security (Bitwarden, KeePassXC, Malwarebytes, Cryptomator)",
    command:
      "winget install --id Bitwarden.Bitwarden -e ; winget install --id KeePassXCTeam.KeePassXC -e ; winget install --id Malwarebytes.Malwarebytes -e ; winget install --id Cryptomator.Cryptomator -e",
    description:
      "Bitwarden (cloud password manager), KeePassXC (offline vault), Malwarebytes (second-opinion scanner), Cryptomator (encrypt folders before syncing to Drive/OneDrive).",
    category: "install",
    shell: "ps",
    tags: ["winget", "security", "passwords"],
  },
  {
    id: "install-sysinternals",
    name: "Kit: Sysinternals power tools (whole suite)",
    command: "winget install --id Microsoft.Sysinternals.Suite -e",
    description:
      "The whole Sysinternals suite (Process Explorer, Autoruns, Procmon, TCPView, PsTools, and dozens more). Microsoft's own advanced Windows toolbox.",
    category: "install",
    shell: "ps",
    tags: ["winget", "sysadmin", "sysinternals"],
  },
  {
    id: "install-powertoys",
    name: "Kit: PowerToys (Microsoft's power-user pack)",
    command: "winget install --id Microsoft.PowerToys -e",
    description:
      "FancyZones, PowerToys Run launcher, Text Extractor OCR, Color Picker, Advanced Paste, Workspaces. Turns Windows 11 into a genuine power-user OS. Free, MIT-licensed, made by MS itself.",
    category: "install",
    shell: "ps",
    tags: ["winget", "powertoys", "productivity"],
  },
  {
    id: "install-notes",
    name: "Kit: Notes + knowledge (Obsidian, Notion, Typora)",
    command:
      "winget install --id Obsidian.Obsidian -e ; winget install --id Notion.Notion -e ; winget install --id Typora.Typora -e",
    description:
      "Obsidian (local-first markdown vault), Notion (cloud workspace), Typora (clean markdown editor). Pick your poison — or install all three.",
    category: "install",
    shell: "ps",
    tags: ["winget", "notes", "markdown"],
  },
  {
    id: "install-browsers",
    name: "Kit: Modern browsers (Firefox, Brave, LibreWolf, Vivaldi)",
    command:
      "winget install --id Mozilla.Firefox -e ; winget install --id Brave.Brave -e ; winget install --id LibreWolf.LibreWolf -e ; winget install --id VivaldiTechnologies.Vivaldi -e",
    description:
      "Firefox (independent), Brave (chromium + adblock), LibreWolf (hardened Firefox), Vivaldi (power-user chromium). Grab whichever you want as a default.",
    category: "install",
    shell: "ps",
    tags: ["winget", "browser"],
  },
  {
    id: "install-launchers",
    name: "Kit: Game launchers (Steam, Epic, GOG, Ubisoft, EA)",
    command:
      "winget install --id Valve.Steam -e ; winget install --id EpicGames.EpicGamesLauncher -e ; winget install --id GOG.Galaxy -e ; winget install --id Ubisoft.Connect -e ; winget install --id ElectronicArts.EADesktop -e",
    description:
      "Every store you'll ever need to launch a game from. Skip the ones you don't use.",
    category: "install",
    shell: "ps",
    tags: ["winget", "gaming", "steam"],
  },
  {
    id: "install-hw-monitoring",
    name: "Kit: Hardware monitoring (HWInfo, CrystalDiskInfo, MSI Afterburner)",
    command:
      "winget install --id REALiX.HWiNFO -e ; winget install --id CrystalDewWorld.CrystalDiskInfo -e ; winget install --id Guru3D.Afterburner -e",
    description:
      "HWInfo = sensors + benchmarks. CrystalDiskInfo = SMART health for every drive. Afterburner = GPU tuning + OSD. The classic homelab diagnostic kit.",
    category: "install",
    shell: "ps",
    tags: ["winget", "monitoring", "hardware"],
  },
  {
    id: "install-uninstallers",
    name: "Kit: Deep cleaners (Revo, BleachBit, WizTree)",
    command:
      "winget install --id RevoUninstaller.RevoUninstaller -e ; winget install --id BleachBit.BleachBit -e ; winget install --id AntibodySoftware.WizTree -e",
    description:
      "Revo = uninstall + hunt leftover registry/files. BleachBit = disk cleaner (open source CCleaner). WizTree = instant disk usage tree — finds what's eating your C:.",
    category: "install",
    shell: "ps",
    tags: ["winget", "cleaner", "disk"],
  },
  {
    id: "install-network-tools",
    name: "Kit: Network tools (Wireshark, nmap, Advanced IP Scanner)",
    command:
      "winget install --id WiresharkFoundation.Wireshark -e ; winget install --id Insecure.Nmap -e ; winget install --id Famatech.AdvancedIPScanner -e",
    description:
      "Wireshark = packet capture. Nmap = network scanner. Advanced IP Scanner = quick LAN sweep GUI. The 'find out what's on my network' bundle.",
    category: "install",
    shell: "ps",
    tags: ["winget", "network", "sysadmin"],
  },
  {
    id: "install-productivity",
    name: "Kit: Productivity (ShareX, Everything, PowerToys, AutoHotkey)",
    command:
      "winget install --id ShareX.ShareX -e ; winget install --id voidtools.Everything -e ; winget install --id Microsoft.PowerToys -e ; winget install --id AutoHotkey.AutoHotkey -e",
    description:
      "ShareX (best free screenshotter), Everything (instant file search), PowerToys, AutoHotkey (custom hotkeys + scripts). The 'why is this not built into Windows' pack.",
    category: "install",
    shell: "ps",
    tags: ["winget", "productivity"],
  },
  {
    id: "install-fonts-devicon",
    name: "Nerd Fonts (CascadiaCode NF, JetBrainsMono NF, FiraCode NF)",
    command:
      "winget install --id DEVCOM.JetBrainsMonoNerdFont -e ; winget install --id DEVCOM.CascadiaCodeNerdFont -e ; winget install --id DEVCOM.FiraCodeNerdFont -e",
    description:
      "Nerd Fonts = patched dev fonts with icons for Starship, Powerline, oh-my-posh, tmux, and terminal file managers. Required for the fancy prompt icons.",
    category: "install",
    shell: "ps",
    tags: ["winget", "font", "terminal"],
  },
  {
    id: "install-wsl",
    name: "Enable WSL (Linux on Windows)",
    command: "wsl --install",
    description:
      "Sets up WSL 2 + Ubuntu in one command. If it wants a reboot, do the reboot before running anything else. WSL is the easiest way to get a real Linux terminal on this box.",
    category: "install",
    shell: "ps",
    admin: true,
    tags: ["wsl", "linux"],
  },

  // ── Debloat ─────────────────────────────────────────────────────
  {
    id: "debloat-remove-teams-consumer",
    name: "Uninstall Teams (consumer)",
    command:
      "Get-AppxPackage MicrosoftTeams | Remove-AppxPackage ; Get-AppxPackage -AllUsers MicrosoftTeams | Remove-AppxPackage",
    description:
      "Removes the personal-account Teams chat that comes pre-pinned to the taskbar. Business/Enterprise Teams (installed via MSI) is untouched.",
    category: "debloat",
    shell: "ps",
    admin: true,
    danger: "low",
    tags: ["appx", "teams"],
  },
  {
    id: "debloat-remove-xbox",
    name: "Uninstall the Xbox app bundle",
    command:
      "Get-AppxPackage *xbox* | Remove-AppxPackage",
    description:
      "Removes the Xbox app + Game Bar + related. If you actually game on this box, skip.",
    category: "debloat",
    shell: "ps",
    admin: true,
    danger: "medium",
    tags: ["appx", "xbox"],
  },
  {
    id: "debloat-remove-onedrive",
    name: "Uninstall OneDrive",
    command:
      'taskkill /f /im OneDrive.exe ; if (Test-Path "$env:systemroot\\SysWOW64\\OneDriveSetup.exe") { Start-Process "$env:systemroot\\SysWOW64\\OneDriveSetup.exe" -ArgumentList "/uninstall" -Wait } elseif (Test-Path "$env:systemroot\\System32\\OneDriveSetup.exe") { Start-Process "$env:systemroot\\System32\\OneDriveSetup.exe" -ArgumentList "/uninstall" -Wait }',
    description:
      "Kills OneDrive and runs its uninstaller. Back your files out of the OneDrive folder first — they don't move automatically.",
    category: "debloat",
    shell: "ps",
    admin: true,
    danger: "high",
    tags: ["onedrive"],
  },
  {
    id: "debloat-remove-copilot",
    name: "Disable Windows Copilot",
    command:
      'reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f',
    description:
      "Turns off the Copilot button + panel. Reversible — re-enable by deleting the same key.",
    category: "debloat",
    shell: "either",
    danger: "low",
    tags: ["copilot", "ai"],
  },
  {
    id: "debloat-list-appx",
    name: "List all pre-installed store apps",
    command: "Get-AppxPackage | Sort-Object Name | Format-Table Name, PackageFullName",
    description:
      "Enumerates every Store/Appx package so you can pick which to uninstall with `Get-AppxPackage <name> | Remove-AppxPackage`.",
    category: "debloat",
    shell: "ps",
    tags: ["appx", "list"],
  },
  {
    id: "debloat-widgets",
    name: "Remove Widgets from the taskbar",
    command:
      "Get-AppxPackage *WebExperience* | Remove-AppxPackage",
    description:
      "Kills the Widgets pane (the weather / news / MSN feed that pops in from the left). Windows will re-add it on major feature updates.",
    category: "debloat",
    shell: "ps",
    admin: true,
    danger: "low",
    tags: ["appx", "widgets", "news"],
  },
  {
    id: "debloat-bing-in-search",
    name: "Kill Bing / web results in Start search",
    command:
      'reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v DisableSearchBoxSuggestions /t REG_DWORD /d 1 /f ; Stop-Process -Name explorer -Force',
    description:
      "Stops the Start menu from pushing Bing web searches when you're just trying to find a local file or app.",
    category: "debloat",
    shell: "either",
    tags: ["bing", "search", "start"],
  },
  {
    id: "debloat-recall",
    name: "Disable Windows Recall",
    command:
      'reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsAI" /v DisableAIDataAnalysis /t REG_DWORD /d 1 /f',
    description:
      "Turns off Recall — the always-on screenshot indexer on newer Windows 11 builds. Reversible by deleting the key.",
    category: "debloat",
    shell: "either",
    tags: ["recall", "ai", "privacy"],
  },
  {
    id: "debloat-taskbar-search",
    name: "Hide the Search box on the taskbar",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v SearchboxTaskbarMode /t REG_DWORD /d 0 /f ; Stop-Process -Name explorer -Force',
    description:
      "0 = hidden, 1 = icon only, 2 = short box, 3 = full box. Restores a bunch of taskbar real estate.",
    category: "debloat",
    shell: "either",
    tags: ["taskbar", "search"],
  },
  {
    id: "debloat-taskbar-chat",
    name: "Hide Teams Chat icon on the taskbar",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarMn /t REG_DWORD /d 0 /f ; Stop-Process -Name explorer -Force',
    description:
      "Just hides the icon — doesn't uninstall Teams consumer. Pair with 'Uninstall Teams (consumer)' for a full sweep.",
    category: "debloat",
    shell: "either",
    tags: ["taskbar", "teams"],
  },

  // ── Privacy ─────────────────────────────────────────────────────
  {
    id: "privacy-disable-telemetry",
    name: "Disable Windows telemetry",
    command:
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f ; Stop-Service DiagTrack ; Set-Service DiagTrack -StartupType Disabled',
    description:
      "Sets telemetry to 0 via policy and stops the Connected User Experiences service. Requires Pro/Enterprise for the policy to fully take (Home ignores AllowTelemetry=0).",
    category: "privacy",
    shell: "ps",
    admin: true,
    danger: "medium",
    tags: ["telemetry"],
  },
  {
    id: "privacy-disable-ads",
    name: "Disable Start-menu suggestions + tips",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SubscribedContent-338388Enabled /t REG_DWORD /d 0 /f ; reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SubscribedContent-338389Enabled /t REG_DWORD /d 0 /f',
    description:
      "Turns off the 'suggested app' promos in Start menu, lock screen, and notification center.",
    category: "privacy",
    shell: "either",
    tags: ["ads"],
  },
  {
    id: "privacy-disable-adid",
    name: "Disable advertising ID",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" /v Enabled /t REG_DWORD /d 0 /f',
    description:
      "Zeroes out the per-user Advertising ID used by apps for cross-app tracking.",
    category: "privacy",
    shell: "either",
    tags: ["ads", "tracking"],
  },
  {
    id: "privacy-disable-cortana",
    name: "Disable Cortana",
    command:
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v AllowCortana /t REG_DWORD /d 0 /f',
    description: "Turns off Cortana search assistance. Reversible by deleting the key.",
    category: "privacy",
    shell: "either",
    admin: true,
    tags: ["cortana"],
  },
  {
    id: "privacy-disable-location",
    name: "Turn location services off",
    command:
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" /v DisableLocation /t REG_DWORD /d 1 /f',
    description:
      "Blocks apps from asking for your location. If you use Weather or Maps you'll want to leave it on.",
    category: "privacy",
    shell: "either",
    admin: true,
    tags: ["location"],
  },
  {
    id: "privacy-clipboard-sync",
    name: "Turn off Windows clipboard cloud sync",
    command:
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System" /v AllowCrossDeviceClipboard /t REG_DWORD /d 0 /f',
    description:
      "Stops the clipboard from syncing across your Microsoft-account devices. Local Win+V history still works.",
    category: "privacy",
    shell: "either",
    admin: true,
    tags: ["clipboard", "sync"],
  },
  {
    id: "privacy-activity-history",
    name: "Disable Activity History",
    command:
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System" /v PublishUserActivities /t REG_DWORD /d 0 /f ; reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System" /v UploadUserActivities /t REG_DWORD /d 0 /f',
    description:
      "Stops Windows recording which files/apps you opened for the Task View timeline.",
    category: "privacy",
    shell: "either",
    admin: true,
    tags: ["timeline", "history"],
  },
  {
    id: "privacy-disable-diagtrack",
    name: "Stop + disable the Diagnostics Tracking service",
    command:
      "Stop-Service -Name DiagTrack -Force ; Set-Service -Name DiagTrack -StartupType Disabled",
    description:
      "Belt-and-braces companion to 'Disable telemetry' — kills the DiagTrack service permanently.",
    category: "privacy",
    shell: "ps",
    admin: true,
    danger: "medium",
    tags: ["telemetry", "diagtrack"],
  },
  {
    id: "privacy-inspect-defender-detections",
    name: "See recent Defender detections",
    command: "Get-MpThreatDetection | Sort-Object InitialDetectionTime -Descending | Select -First 20",
    description:
      "Read-only. Shows the last 20 things Microsoft Defender flagged — useful when you want to know what it caught.",
    category: "privacy",
    shell: "ps",
    tags: ["defender", "audit"],
  },

  // ── Performance ─────────────────────────────────────────────────
  {
    id: "perf-ultimate-power",
    name: "Enable Ultimate Performance power plan",
    command:
      "powercfg /duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61",
    description:
      "Unlocks the hidden Ultimate Performance plan (mainly disables aggressive idle throttling). Set it active from Power Options.",
    category: "performance",
    shell: "either",
    admin: true,
    tags: ["power"],
  },
  {
    id: "perf-disable-hibernation",
    name: "Disable hibernation (reclaim ~RAM-size on disk)",
    command: "powercfg /h off",
    description:
      "Turns off hibernation and deletes hiberfil.sys. Frees roughly your RAM size on C:. Turn back on with `powercfg /h on`.",
    category: "performance",
    shell: "either",
    admin: true,
    danger: "medium",
    tags: ["hibernate", "diskspace"],
  },
  {
    id: "perf-visual-effects-perf",
    name: "Visual effects → Adjust for best performance",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f',
    description:
      "Sets Windows to prioritize performance over animations/shadows/etc. Sign out or restart Explorer for full effect.",
    category: "performance",
    shell: "either",
    tags: ["animations", "explorer"],
  },
  {
    id: "perf-disable-startup",
    name: "Open Startup app manager",
    command: "taskmgr /0 /startup",
    description:
      "Opens Task Manager directly on the Startup tab so you can disable everything auto-launching at login.",
    category: "performance",
    shell: "either",
    tags: ["startup", "boot"],
  },
  {
    id: "perf-dns-cloudflare",
    name: "Switch DNS to Cloudflare (1.1.1.1)",
    command:
      'Get-NetAdapter -Physical | Where-Object Status -eq "Up" | Set-DnsClientServerAddress -ServerAddresses ("1.1.1.1","1.0.0.1")',
    description:
      "Sets Cloudflare DNS on every up physical adapter. Reset with `Set-DnsClientServerAddress -ResetServerAddresses`.",
    category: "performance",
    shell: "ps",
    admin: true,
    tags: ["dns"],
  },
  {
    id: "perf-dns-quad9",
    name: "Switch DNS to Quad9 (9.9.9.9) — with malware blocking",
    command:
      'Get-NetAdapter -Physical | Where-Object Status -eq "Up" | Set-DnsClientServerAddress -ServerAddresses ("9.9.9.9","149.112.112.112")',
    description:
      "Quad9 blocks known malware / phishing domains at the DNS level. Good default for a non-technical household.",
    category: "performance",
    shell: "ps",
    admin: true,
    tags: ["dns", "security"],
  },
  {
    id: "perf-trim-ssd",
    name: "Trim / optimize all SSDs",
    command: "Get-Volume | Optimize-Volume -ReTrim -Verbose",
    description:
      "Runs a manual TRIM pass over every SSD volume. Windows does this weekly on its own; use when the schedule slipped.",
    category: "performance",
    shell: "ps",
    admin: true,
    tags: ["ssd", "trim"],
  },
  {
    id: "perf-background-apps",
    name: "Disable background apps for all users",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 1 /f',
    description:
      "Stops UWP apps from running in the background eating CPU + battery. Foreground behavior is unchanged.",
    category: "performance",
    shell: "either",
    tags: ["battery", "background"],
  },
  {
    id: "perf-fast-startup-off",
    name: "Turn Fast Startup off",
    command: "powercfg -h off ; powercfg -h on ; powercfg /setacvalueindex SCHEME_CURRENT SUB_NONE HIBERNATEIDLE 0",
    description:
      "Fast Startup causes weird 'the machine isn't really shut down' bugs (wrong clock after dual-boot, network stack in a half-state). Slower boot but a clean one.",
    category: "performance",
    shell: "ps",
    admin: true,
    danger: "low",
    tags: ["boot", "hibernate"],
  },
  {
    id: "perf-gpu-hardware-scheduling",
    name: "Enable Hardware-Accelerated GPU Scheduling",
    command:
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f',
    description:
      "Lets the GPU manage its own frame scheduling. Small but real gains in games — takes a reboot.",
    category: "performance",
    shell: "either",
    admin: true,
    tags: ["gpu", "gaming"],
  },
  {
    id: "perf-disable-search-indexing",
    name: "Turn off Windows Search indexing",
    command: "Stop-Service WSearch ; Set-Service WSearch -StartupType Disabled",
    description:
      "Kills the file-content indexer. Start menu app search still works. Only worth it on low-RAM boxes — most SSDs don't notice the indexer.",
    category: "performance",
    shell: "ps",
    admin: true,
    danger: "medium",
    tags: ["search", "index"],
  },
  {
    id: "perf-cleanup-mgr",
    name: "Open Disk Cleanup (system files)",
    command: "cleanmgr /sageset:99 ; cleanmgr /sagerun:99",
    description:
      "Opens Disk Cleanup with 'clean up system files' enabled — reclaims Windows Update rollback + old installer caches. Often 5-30 GB.",
    category: "performance",
    shell: "either",
    admin: true,
    tags: ["disk", "cleanup"],
  },

  // ── Fixes ───────────────────────────────────────────────────────
  {
    id: "fix-sfc-dism",
    name: "Repair Windows (DISM + SFC)",
    command:
      "DISM /Online /Cleanup-Image /RestoreHealth ; sfc /scannow",
    description:
      "Runs the two canonical Windows repair commands in the right order (DISM restores the component store, SFC repairs system files from it).",
    category: "fix",
    shell: "ps",
    admin: true,
    tags: ["repair", "sfc", "dism"],
  },
  {
    id: "fix-reset-network",
    name: "Full network stack reset",
    command:
      "netsh int ip reset ; netsh winsock reset ; ipconfig /flushdns ; ipconfig /release ; ipconfig /renew",
    description:
      "The nuclear network-fix combo. Reboot after. Will forget custom DNS/static IPs.",
    category: "fix",
    shell: "ps",
    admin: true,
    danger: "high",
    tags: ["network", "reset"],
  },
  {
    id: "fix-clear-icon-cache",
    name: "Rebuild icon + thumbnail cache",
    command:
      "taskkill /F /IM explorer.exe ; Remove-Item \"$env:LocalAppData\\Microsoft\\Windows\\Explorer\\iconcache*\" -Force -ErrorAction SilentlyContinue ; Remove-Item \"$env:LocalAppData\\Microsoft\\Windows\\Explorer\\thumbcache*\" -Force -ErrorAction SilentlyContinue ; Start-Process explorer.exe",
    description:
      "Fixes broken icons on the desktop / File Explorer by clearing the caches and restarting Explorer.",
    category: "fix",
    shell: "ps",
    tags: ["icons", "explorer"],
  },
  {
    id: "fix-store-reset",
    name: "Reset Microsoft Store",
    command: "wsreset.exe",
    description: "Clears Store cache. Use when Store won't load or downloads hang.",
    category: "fix",
    shell: "either",
    tags: ["store"],
  },
  {
    id: "fix-restart-audio",
    name: "Restart the audio service",
    command:
      "Restart-Service Audiosrv -Force ; Restart-Service AudioEndpointBuilder -Force",
    description:
      "Fixes the 'no audio devices installed' or muted-after-sleep glitch without a reboot.",
    category: "fix",
    shell: "ps",
    admin: true,
    tags: ["audio", "sound"],
  },
  {
    id: "fix-reset-windows-update",
    name: "Reset Windows Update from scratch",
    command:
      "Stop-Service wuauserv,cryptSvc,bits,msiserver -Force ; Rename-Item C:\\Windows\\SoftwareDistribution C:\\Windows\\SoftwareDistribution.old -ErrorAction SilentlyContinue ; Rename-Item C:\\Windows\\System32\\catroot2 C:\\Windows\\System32\\catroot2.old -ErrorAction SilentlyContinue ; Start-Service wuauserv,cryptSvc,bits,msiserver",
    description:
      "The nuclear Windows Update fix. Stops the services, renames the cache, restarts. Use when 'Check for updates' has been spinning or throwing 0x800…-style errors.",
    category: "fix",
    shell: "ps",
    admin: true,
    danger: "medium",
    tags: ["windows update", "wu"],
  },
  {
    id: "fix-clear-print-queue",
    name: "Clear a stuck print queue",
    command:
      "Stop-Service Spooler -Force ; Remove-Item C:\\Windows\\System32\\spool\\PRINTERS\\* -Force -ErrorAction SilentlyContinue ; Start-Service Spooler",
    description:
      "Kills the print spooler, wipes any queued print jobs, restarts. Fixes the classic 'the printer sees the job but nothing prints' pain.",
    category: "fix",
    shell: "ps",
    admin: true,
    tags: ["print"],
  },
  {
    id: "fix-restart-explorer",
    name: "Restart Windows Explorer",
    command: "Stop-Process -Name explorer -Force",
    description:
      "Restarts the taskbar / desktop / File Explorer process. Fixes hung system tray, missing icons, or broken tooltips without a reboot.",
    category: "fix",
    shell: "ps",
    tags: ["explorer", "taskbar"],
  },
  {
    id: "fix-flush-dns",
    name: "Flush DNS cache",
    command: "ipconfig /flushdns",
    description:
      "Clears the DNS resolver cache. Try this first when a site suddenly won't load but works on your phone.",
    category: "fix",
    shell: "either",
    tags: ["dns", "network"],
  },
  {
    id: "fix-check-disk",
    name: "Schedule chkdsk on C: at next boot",
    command: "chkdsk C: /f /r /x",
    description:
      "Locks the drive and schedules a full read + repair pass at reboot. Use when you suspect filesystem corruption (weird BSODs, chronic Explorer freezes).",
    category: "fix",
    shell: "either",
    admin: true,
    danger: "high",
    tags: ["disk", "chkdsk"],
  },
  {
    id: "fix-safe-mode-next",
    name: "Reboot into Safe Mode",
    command: "shutdown /r /o /f /t 0",
    description:
      "Reboots straight into the Windows Recovery Environment where you can pick Startup Settings → Safe Mode.",
    category: "fix",
    shell: "either",
    admin: true,
    danger: "medium",
    tags: ["safemode", "recovery"],
  },
  {
    id: "fix-restore-store-apps",
    name: "Re-register every Store app",
    command:
      'Get-AppxPackage -AllUsers | Foreach { Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\\AppxManifest.xml" -ErrorAction SilentlyContinue }',
    description:
      "Rebuilds every UWP/Store app for the current user. Fix for missing Start menu tiles, Photos won't open, Calculator gone.",
    category: "fix",
    shell: "ps",
    admin: true,
    danger: "medium",
    tags: ["appx", "store", "repair"],
  },

  // ── UI Tweaks ───────────────────────────────────────────────────
  {
    id: "ui-taskbar-left",
    name: "Move taskbar icons back to the left (Win 11)",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAl /t REG_DWORD /d 0 /f ; Stop-Process -Name explorer -Force',
    description:
      "Reverts the Win 11 centered-taskbar to Win 10-style left-aligned. Explorer restarts to apply.",
    category: "ui",
    shell: "ps",
    tags: ["taskbar", "win11"],
  },
  {
    id: "ui-show-extensions",
    name: "Show file extensions",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v HideFileExt /t REG_DWORD /d 0 /f ; Stop-Process -Name explorer -Force',
    description:
      "Un-hides file extensions in Explorer. Non-negotiable for anyone doing real work.",
    category: "ui",
    shell: "ps",
    tags: ["explorer", "extensions"],
  },
  {
    id: "ui-show-hidden",
    name: "Show hidden files",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Hidden /t REG_DWORD /d 1 /f ; Stop-Process -Name explorer -Force',
    description: "Show hidden and system files in Explorer.",
    category: "ui",
    shell: "ps",
    tags: ["explorer", "hidden"],
  },
  {
    id: "ui-dark-mode",
    name: "Enable dark mode (apps + system)",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme /t REG_DWORD /d 0 /f ; reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v SystemUsesLightTheme /t REG_DWORD /d 0 /f',
    description: "Global dark mode. No sign-out needed for most apps.",
    category: "ui",
    shell: "either",
    tags: ["theme", "dark"],
  },
  {
    id: "ui-classic-context-menu",
    name: "Bring back classic (full) right-click menu — Win 11",
    command:
      'reg add "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32" /f /ve ; Stop-Process -Name explorer -Force',
    description:
      "Turns off the abbreviated Win 11 right-click menu and restores the full one. Reversible: `reg delete \"HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\" /f`.",
    category: "ui",
    shell: "either",
    tags: ["contextmenu", "win11"],
  },
  {
    id: "ui-seconds-in-clock",
    name: "Show seconds in the taskbar clock",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowSecondsInSystemClock /t REG_DWORD /d 1 /f ; Stop-Process -Name explorer -Force',
    description:
      "Adds :seconds to the system-tray clock. Small quality-of-life win.",
    category: "ui",
    shell: "either",
    tags: ["taskbar", "clock"],
  },
  {
    id: "ui-verbose-boot",
    name: "Verbose boot messages",
    command:
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v VerboseStatus /t REG_DWORD /d 1 /f',
    description:
      "Shows 'Applying policy X', 'Starting service Y' during boot / login instead of just the spinner. Useful for diagnosing slow logins.",
    category: "ui",
    shell: "either",
    admin: true,
    tags: ["boot", "diagnostics"],
  },
  {
    id: "ui-explorer-open-to-this-pc",
    name: "Open File Explorer to 'This PC' instead of Home",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v LaunchTo /t REG_DWORD /d 1 /f ; Stop-Process -Name explorer -Force',
    description:
      "Skips the 'Recent files' / 'Home' pane and goes straight to drives. Faster if you always start at a drive letter.",
    category: "ui",
    shell: "either",
    tags: ["explorer"],
  },
  {
    id: "ui-compact-mode",
    name: "Compact File Explorer (less spacing)",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v UseCompactMode /t REG_DWORD /d 1 /f ; Stop-Process -Name explorer -Force',
    description:
      "Tightens up File Explorer row spacing to Win 10 density.",
    category: "ui",
    shell: "either",
    tags: ["explorer", "density"],
  },
  {
    id: "ui-toggle-lock-screen-tips",
    name: "Disable lock-screen tips + ads",
    command:
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v RotatingLockScreenOverlayEnabled /t REG_DWORD /d 0 /f ; reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SubscribedContent-338387Enabled /t REG_DWORD /d 0 /f',
    description:
      "Kills the 'fun facts' + Microsoft app pitches on the lock screen (Spotlight images stay).",
    category: "ui",
    shell: "either",
    tags: ["lockscreen", "ads"],
  },
];

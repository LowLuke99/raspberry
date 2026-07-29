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
];

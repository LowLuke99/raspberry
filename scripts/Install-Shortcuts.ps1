# Raspberry — install / refresh desktop + Start Menu shortcuts.
#
# Creates shortcuts in two places so the app is easy to reach:
#   Desktop:
#     - "Raspberry"        → launches raspberry-hub.exe DIRECTLY (fast, native icon, no console flash)
#     - "Update Raspberry" → runs Update-Silent.vbs → hidden PowerShell → WinForms progress UI
#   Start Menu (under a "Raspberry" folder):
#     - "Raspberry"        → same launcher (so Win-key search finds it, and it can be pinned)
#     - "Update Raspberry" → same updater
#     - "Raspberry Folder" → opens the repo root in Explorer
#
# Re-run any time to refresh the shortcuts (safe to run repeatedly). Also
# refreshes the Windows shell icon cache so a rebuilt exe picks up the
# right icon immediately.

$ErrorActionPreference = "Stop"
$RepoRoot   = Split-Path $PSScriptRoot -Parent
$Desktop    = [Environment]::GetFolderPath("Desktop")
$StartMenu  = [Environment]::GetFolderPath("Programs")
$IconSource = Join-Path $RepoRoot "apps\hub\src-tauri\icons\icon.ico"
$ExePath    = Join-Path $RepoRoot "target\release\raspberry-hub.exe"
$UpdateVbs  = Join-Path $RepoRoot "scripts\Update-Silent.vbs"

$StartMenuFolder = Join-Path $StartMenu "Raspberry"
if (-not (Test-Path $StartMenuFolder)) {
  New-Item -ItemType Directory -Path $StartMenuFolder | Out-Null
}

$Shell = New-Object -ComObject WScript.Shell

function New-DirectShortcut {
  param(
    [string]$LinkPath,
    [string]$Target,
    [string]$Arguments = "",
    [string]$WorkDir,
    [string]$Description,
    [string]$Icon
  )
  $lnk = $Shell.CreateShortcut($LinkPath)
  $lnk.TargetPath       = $Target
  $lnk.Arguments        = $Arguments
  $lnk.WorkingDirectory = $WorkDir
  $lnk.WindowStyle      = 1
  $lnk.Description      = $Description
  if ($Icon -and (Test-Path $Icon)) { $lnk.IconLocation = "$Icon,0" }
  $lnk.Save()
}

$launchLnk = Join-Path $Desktop "Raspberry.lnk"
$updateLnk = Join-Path $Desktop "Update Raspberry.lnk"

Write-Host "Installing Raspberry desktop shortcuts:" -ForegroundColor Magenta

# 1. Launch shortcut — direct exe. No PowerShell wrapper, no console flash.
#    Windows uses the exe's embedded icon in the taskbar automatically.
if (Test-Path $ExePath) {
  New-DirectShortcut `
    -LinkPath $launchLnk `
    -Target $ExePath `
    -WorkDir (Split-Path $ExePath -Parent) `
    -Description "Open Raspberry" `
    -Icon $IconSource
  Write-Host "   [OK] Raspberry.lnk -> $ExePath" -ForegroundColor Green
} else {
  # Exe not built yet — fall back to a PowerShell wrapper that shows a
  # friendly "run the updater first" dialog when double-clicked.
  $launchScript = Join-Path $RepoRoot "scripts\Launch-Raspberry.ps1"
  New-DirectShortcut `
    -LinkPath $launchLnk `
    -Target "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -Arguments "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launchScript`"" `
    -WorkDir $RepoRoot `
    -Description "Open Raspberry (needs build first)" `
    -Icon $IconSource
  Write-Host "   [WARN] Raspberry.lnk -> fallback launcher (exe missing; run 'Update Raspberry' first)" -ForegroundColor Yellow
}

# 2. Update shortcut — wscript.exe + VBS so there's NO console window flash.
#    The VBS spawns hidden PowerShell which shows a WinForms progress dialog.
New-DirectShortcut `
  -LinkPath $updateLnk `
  -Target "$env:WINDIR\System32\wscript.exe" `
  -Arguments "`"$UpdateVbs`"" `
  -WorkDir $RepoRoot `
  -Description "Pull latest from GitHub, rebuild, and open Raspberry" `
  -Icon $IconSource
Write-Host "   [OK] Update Raspberry.lnk -> wscript $UpdateVbs" -ForegroundColor Green

# 3. Start Menu mirror — so Win-key search finds "Raspberry" and it can be
#    pinned to Start / taskbar via right-click. Grouped under a "Raspberry"
#    folder so it doesn't scatter into the flat A-Z list.
$startLaunch = Join-Path $StartMenuFolder "Raspberry.lnk"
$startUpdate = Join-Path $StartMenuFolder "Update Raspberry.lnk"
$startFolder = Join-Path $StartMenuFolder "Raspberry Folder.lnk"

if (Test-Path $ExePath) {
  New-DirectShortcut `
    -LinkPath $startLaunch `
    -Target $ExePath `
    -WorkDir (Split-Path $ExePath -Parent) `
    -Description "Open Raspberry" `
    -Icon $IconSource
  Write-Host "   [OK] Start Menu\Raspberry\Raspberry.lnk" -ForegroundColor Green
}

New-DirectShortcut `
  -LinkPath $startUpdate `
  -Target "$env:WINDIR\System32\wscript.exe" `
  -Arguments "`"$UpdateVbs`"" `
  -WorkDir $RepoRoot `
  -Description "Pull latest from GitHub, rebuild, and open Raspberry" `
  -Icon $IconSource
Write-Host "   [OK] Start Menu\Raspberry\Update Raspberry.lnk" -ForegroundColor Green

# Explorer-to-repo shortcut — one click into the project folder.
New-DirectShortcut `
  -LinkPath $startFolder `
  -Target "$env:WINDIR\explorer.exe" `
  -Arguments "`"$RepoRoot`"" `
  -WorkDir $RepoRoot `
  -Description "Open the Raspberry repo folder in Explorer" `
  -Icon $IconSource
Write-Host "   [OK] Start Menu\Raspberry\Raspberry Folder.lnk" -ForegroundColor Green

# 4. Nudge the shell icon cache so the new icon shows up right away.
try {
  ie4uinit.exe -show 2>$null | Out-Null
} catch { }

Write-Host ""
Write-Host "Done. Access Raspberry from:" -ForegroundColor Cyan
Write-Host "   - Desktop      : Raspberry, Update Raspberry"
Write-Host "   - Start Menu   : Raspberry folder (search 'Raspberry' with the Windows key)"
Write-Host "   - Right-click a Start Menu shortcut -> 'Pin to Start' or 'Pin to taskbar'"

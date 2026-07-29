# Raspberry — install desktop shortcuts.
#
# Run this ONCE. It creates two shortcuts on your Desktop:
#   - "Raspberry"        → opens the app fast (no rebuild)
#   - "Update Raspberry" → pulls from GitHub + rebuilds + opens the fresh app
#
# Re-run any time to refresh the shortcuts (safe to run repeatedly).

$ErrorActionPreference = "Stop"
$RepoRoot   = Split-Path $PSScriptRoot -Parent
$Desktop    = [Environment]::GetFolderPath("Desktop")
$IconSource = Join-Path $RepoRoot "apps\hub\src-tauri\icons\icon.ico"

$Shell = New-Object -ComObject WScript.Shell

function New-PsShortcut([string]$LinkPath, [string]$PsScript, [string]$Description) {
  $lnk = $Shell.CreateShortcut($LinkPath)
  $lnk.TargetPath       = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
  $lnk.Arguments        = "-NoProfile -ExecutionPolicy Bypass -File `"$PsScript`""
  $lnk.WorkingDirectory = $RepoRoot
  $lnk.WindowStyle      = 1
  $lnk.Description      = $Description
  if (Test-Path $IconSource) { $lnk.IconLocation = $IconSource }
  $lnk.Save()
}

$launchScript = Join-Path $RepoRoot "scripts\Launch-Raspberry.ps1"
$updateScript = Join-Path $RepoRoot "scripts\Update-Raspberry.ps1"

$launchLnk = Join-Path $Desktop "Raspberry.lnk"
$updateLnk = Join-Path $Desktop "Update Raspberry.lnk"

Write-Host "Installing shortcuts on Desktop:" -ForegroundColor Magenta
Write-Host "   $launchLnk"
New-PsShortcut $launchLnk $launchScript "Open Raspberry (no rebuild)"
Write-Host "   $updateLnk"
New-PsShortcut $updateLnk $updateScript "Pull latest, rebuild, and open Raspberry"

Write-Host ""
Write-Host "Done. Double-click 'Update Raspberry' the first time to build the app," -ForegroundColor Green
Write-Host "then 'Raspberry' any time to open it." -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor DarkGray
[void][System.Console]::ReadKey($true)

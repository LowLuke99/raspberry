# Raspberry — fast launcher.
#
# Just runs the already-built Raspberry.exe (no rebuild).
# Use this shortcut for daily "open the app". Use Update-Raspberry.ps1 (or its
# desktop shortcut) when you actually want the latest code from GitHub.

$RepoRoot = Split-Path $PSScriptRoot -Parent
$ExePath  = Join-Path $RepoRoot "apps\hub\src-tauri\target\release\Raspberry.exe"

if (-not (Test-Path $ExePath)) {
  Write-Host "Raspberry.exe not found — run Update-Raspberry.ps1 first to build it." -ForegroundColor Red
  Write-Host "   expected: $ExePath" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "Press any key to close..." -ForegroundColor DarkGray
  [void][System.Console]::ReadKey($true)
  exit 1
}

Start-Process -FilePath $ExePath

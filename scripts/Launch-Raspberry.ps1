# Raspberry — fast launcher (fallback / debug).
#
# The primary desktop shortcut targets raspberry-hub.exe DIRECTLY (see
# Install-Shortcuts.ps1), which is faster, gets the app icon natively,
# and never flashes a PowerShell console. This script exists as a
# manual/debug launcher and as a safety net if the exe path ever moves.

$RepoRoot = Split-Path $PSScriptRoot -Parent
$ExePath  = Join-Path $RepoRoot "target\release\raspberry-hub.exe"

if (-not (Test-Path $ExePath)) {
  Add-Type -AssemblyName System.Windows.Forms | Out-Null
  [System.Windows.Forms.MessageBox]::Show(
    "raspberry-hub.exe not found. Double-click 'Update Raspberry' on your Desktop to build it.`n`nExpected:`n$ExePath",
    "Raspberry",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  ) | Out-Null
  exit 1
}

Start-Process -FilePath $ExePath

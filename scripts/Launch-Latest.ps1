# Raspberry - always-latest one-click launcher.
#
# What it does:
#   1. If the exe doesn't exist yet: run the updater (which builds + launches).
#   2. Otherwise: git fetch (fast, ~1s on cached remote) and compare local
#      HEAD to origin/HEAD.
#        - Same commit  -> launch the exe immediately. No dialog.
#        - Behind       -> run the updater (pulls, rebuilds, launches).
#   3. If git or the network is unreachable: fall back to launching the
#      current exe. Better to open the app you have than to error out.
#
# Called via Launch-Silent.vbs (wscript) so there is zero console flash.

$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path $PSScriptRoot -Parent
$ExePath  = Join-Path $RepoRoot "target\release\raspberry-hub.exe"
$Updater  = Join-Path $RepoRoot "scripts\Update-Raspberry.ps1"

function Start-Updater {
  if (-not (Test-Path $Updater)) {
    if (Test-Path $ExePath) { Start-Process -FilePath $ExePath }
    return
  }
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-WindowStyle","Hidden","-File","`"$Updater`"") `
    -WindowStyle Hidden
}

# No exe -> we must build. Delegates to the updater.
if (-not (Test-Path $ExePath)) {
  Start-Updater
  exit 0
}

Set-Location $RepoRoot

# Fast connectivity + fetch. Any git failure -> just launch what we have.
$fetchOk = $false
try {
  $p = Start-Process -FilePath "git" -ArgumentList @("fetch","--quiet","origin") `
    -NoNewWindow -Wait -PassThru -RedirectStandardOutput "NUL" -RedirectStandardError "NUL"
  if ($p.ExitCode -eq 0) { $fetchOk = $true }
} catch { }

if (-not $fetchOk) {
  Start-Process -FilePath $ExePath
  exit 0
}

# Count commits we are behind the upstream tracking branch.
$behind = 0
try {
  $tmp = New-TemporaryFile
  $p = Start-Process -FilePath "git" `
    -ArgumentList @("rev-list","--count","HEAD..@{u}") `
    -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tmp.FullName -RedirectStandardError "NUL"
  if ($p.ExitCode -eq 0) {
    $raw = (Get-Content $tmp.FullName -Raw -ErrorAction SilentlyContinue)
    if ($raw) { [int]::TryParse($raw.Trim(), [ref]$behind) | Out-Null }
  }
  Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
} catch { }

if ($behind -gt 0) {
  Start-Updater
} else {
  Start-Process -FilePath $ExePath
}

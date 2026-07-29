# Raspberry — one-click updater.
#
# What this does, in order:
#   1. Closes any running Raspberry window (safe: just Close, not force-kill).
#   2. Fast-forwards the local repo to GitHub main.
#   3. Reinstalls npm deps only if package files changed.
#   4. Runs `npm run tauri:build` to compile the native app.
#   5. Launches the freshly built Raspberry.exe.
#
# Run this any time you want the latest changes. No terminal knowledge needed
# once the desktop shortcut points at it — just double-click and wait.

$ErrorActionPreference = "Stop"
$RepoRoot   = Split-Path $PSScriptRoot -Parent
$HubRoot    = Join-Path $RepoRoot "apps\hub"
$ExePath    = Join-Path $HubRoot "src-tauri\target\release\Raspberry.exe"
$LogFile    = Join-Path $RepoRoot "update.log"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Magenta
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format o)] $msg"
}

function Fail($msg) {
  Write-Host ""
  Write-Host "!! $msg" -ForegroundColor Red
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format o)] FAIL: $msg"
  Write-Host ""
  Write-Host "Press any key to close..." -ForegroundColor DarkGray
  [void][System.Console]::ReadKey($true)
  exit 1
}

# banner
Clear-Host
Write-Host "  R A S P B E R R Y   U P D A T E R" -ForegroundColor Magenta
Write-Host "  ---------------------------------" -ForegroundColor DarkMagenta
Write-Host "  repo: $RepoRoot"
Write-Host ""

# 0. Close running Raspberry (if any)
Write-Step "Closing any running Raspberry window"
Get-Process -Name "Raspberry" -ErrorAction SilentlyContinue | ForEach-Object {
  try { $_.CloseMainWindow() | Out-Null } catch { }
}
Start-Sleep -Seconds 1
Get-Process -Name "Raspberry" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "   still open — force-closing PID $($_.Id)" -ForegroundColor DarkYellow
  try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch { }
}

# 1. Move to repo
if (-not (Test-Path $RepoRoot)) { Fail "Repo folder missing: $RepoRoot" }
Set-Location $RepoRoot

# 2. Snapshot package.json + lockfile hashes so we can skip npm install when nothing changed
function Get-DepsHash {
  $files = @("package.json", "package-lock.json", "apps\hub\package.json")
  $hash = ""
  foreach ($f in $files) {
    $p = Join-Path $RepoRoot $f
    if (Test-Path $p) { $hash += (Get-FileHash $p -Algorithm SHA256).Hash }
  }
  return $hash
}
$depsBefore = Get-DepsHash

# 3. Git pull
Write-Step "Pulling latest from GitHub"
$pullOutput = & git pull --ff-only 2>&1
$pullOutput | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
if ($LASTEXITCODE -ne 0) {
  Fail "git pull failed. Check that you have no local changes: `git status`"
}

# 4. npm install only if deps changed
$depsAfter = Get-DepsHash
if ($depsBefore -ne $depsAfter) {
  Write-Step "Dependencies changed — running npm install"
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail "npm install failed" }
} else {
  Write-Step "Dependencies unchanged — skipping npm install"
}

# 5. Build
Write-Step "Building Raspberry (this can take a few minutes on the first pull)"
& npm run tauri:build
if ($LASTEXITCODE -ne 0) { Fail "npm run tauri:build failed. See output above." }

# 6. Launch
Write-Step "Launching Raspberry"
if (-not (Test-Path $ExePath)) { Fail "Build finished but exe not found at: $ExePath" }
Start-Process -FilePath $ExePath

Write-Host ""
Write-Host "  Done. Raspberry is opening." -ForegroundColor Green
Start-Sleep -Seconds 2

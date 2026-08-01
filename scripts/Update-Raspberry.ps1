# Raspberry - one-click updater with a WinForms progress UI.
#
# Launched two ways:
#   1. Direct double-click on the "Update Raspberry" shortcut (via Update-Silent.vbs)
#      -> no console window, just the dark WinForms dialog
#   2. Debug mode: right-click .ps1 -> Run with PowerShell (console + dialog)
#
# Pipeline: close running app -> git pull -> npm install if deps changed ->
# tauri build -> launch fresh raspberry-hub.exe. Every step reports into the
# UI so the user sees progress instead of a mysterious silent process.
#
# NOTE: this file is intentionally pure ASCII. PowerShell 5.1 reads .ps1
# files in the system ANSI codepage, which mangles unicode em-dashes /
# arrows and turns them into parse errors. Keep it ASCII forever.

$ErrorActionPreference = "Stop"
$RepoRoot   = Split-Path $PSScriptRoot -Parent
$ExePath    = Join-Path $RepoRoot "target\release\raspberry-hub.exe"
$LogFile    = Join-Path $RepoRoot "update.log"
$IconPath   = Join-Path $RepoRoot "apps\hub\src-tauri\icons\icon.ico"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- UI ---------------------------------------------------------------------

$form = New-Object System.Windows.Forms.Form
$form.Text = "Raspberry Updater"
$form.Size = New-Object System.Drawing.Size(540, 280)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(18, 18, 22)
$form.ForeColor = [System.Drawing.Color]::FromArgb(230, 230, 235)
$form.TopMost = $true
if (Test-Path $IconPath) {
  try { $form.Icon = New-Object System.Drawing.Icon($IconPath) } catch { }
}

$title = New-Object System.Windows.Forms.Label
$title.Text = "RASPBERRY"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(220, 90, 130)
$title.Location = New-Object System.Drawing.Point(24, 20)
$title.Size = New-Object System.Drawing.Size(480, 36)
$form.Controls.Add($title)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = "Checking for updates..."
$sub.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$sub.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 190)
$sub.Location = New-Object System.Drawing.Point(24, 62)
$sub.Size = New-Object System.Drawing.Size(480, 22)
$form.Controls.Add($sub)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(24, 96)
$progress.Size = New-Object System.Drawing.Size(480, 16)
$progress.Style = "Marquee"
$progress.MarqueeAnimationSpeed = 25
$form.Controls.Add($progress)

$status = New-Object System.Windows.Forms.Label
$status.Text = ""
$status.Font = New-Object System.Drawing.Font("Consolas", 9)
$status.ForeColor = [System.Drawing.Color]::FromArgb(140, 200, 160)
$status.Location = New-Object System.Drawing.Point(24, 124)
$status.Size = New-Object System.Drawing.Size(480, 80)
$form.Controls.Add($status)

$closeBtn = New-Object System.Windows.Forms.Button
$closeBtn.Text = "Close"
$closeBtn.Location = New-Object System.Drawing.Point(424, 212)
$closeBtn.Size = New-Object System.Drawing.Size(80, 28)
$closeBtn.BackColor = [System.Drawing.Color]::FromArgb(40, 40, 46)
$closeBtn.ForeColor = [System.Drawing.Color]::FromArgb(230, 230, 235)
$closeBtn.FlatStyle = "Flat"
$closeBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(80, 80, 88)
$closeBtn.Enabled = $false
$closeBtn.Add_Click({ $form.Close() })
$form.Controls.Add($closeBtn)

$form.Show()
$form.Activate()
[System.Windows.Forms.Application]::DoEvents()

function Set-Step {
  param([string]$Caption)
  $sub.Text = $Caption
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format o)] $Caption"
  [System.Windows.Forms.Application]::DoEvents()
}
function Set-Status {
  param([string]$Line, [bool]$Ok = $true)
  $status.ForeColor = if ($Ok) {
    [System.Drawing.Color]::FromArgb(140, 200, 160)
  } else {
    [System.Drawing.Color]::FromArgb(230, 120, 120)
  }
  $status.Text = $Line
  [System.Windows.Forms.Application]::DoEvents()
}
function Fail-With {
  param([string]$Msg)
  Set-Step "Update failed"
  Set-Status $Msg $false
  $progress.Style = "Blocks"
  $progress.Value = 0
  $closeBtn.Enabled = $true
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format o)] FAIL: $Msg"
  [System.Windows.Forms.Application]::Run($form)
  exit 1
}

# --- pipeline ---------------------------------------------------------------

try {
  Set-Step "Closing any running Raspberry window"
  Get-Process -Name "raspberry-hub","Raspberry" -ErrorAction SilentlyContinue | ForEach-Object {
    try { $_.CloseMainWindow() | Out-Null } catch { }
  }
  Start-Sleep -Milliseconds 800
  Get-Process -Name "raspberry-hub","Raspberry" -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch { }
  }

  if (-not (Test-Path $RepoRoot)) { Fail-With "Repo missing: $RepoRoot" }
  Set-Location $RepoRoot

  function Get-DepsHash {
    $files = @("package.json", "package-lock.json", "apps\hub\package.json")
    $h = ""
    foreach ($f in $files) {
      $p = Join-Path $RepoRoot $f
      if (Test-Path $p) { $h += (Get-FileHash $p -Algorithm SHA256).Hash }
    }
    return $h
  }
  $depsBefore = Get-DepsHash

  Set-Step "Pulling latest from GitHub"
  # Auto-stash any local edits so a fast-forward pull can't be blocked by a
  # dirty tree. Recovers gracefully from "your local changes would be
  # overwritten" instead of dying on the user.
  $dirty = (& git status --porcelain 2>&1) -join ""
  $stashed = $false
  if ($dirty) {
    Set-Status "Local changes detected - stashing before pull."
    & git stash push -u -m "raspberry-updater auto-stash $(Get-Date -Format o)" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $stashed = $true }
  }
  $pullOut = & git pull --ff-only 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ($stashed) { & git stash pop 2>&1 | Out-Null }
    Fail-With "git pull failed: $($pullOut -join '; ')"
  }
  if ($stashed) {
    & git stash pop 2>&1 | Out-Null
    Set-Status "Local changes restored on top of the pull."
  } else {
    $tail = ($pullOut | Select-Object -Last 3 | Out-String).Trim()
    if ($tail) { Set-Status $tail }
  }

  $depsAfter = Get-DepsHash
  if ($depsBefore -ne $depsAfter) {
    Set-Step "Dependencies changed - running npm install"
    & npm install --no-audit --no-fund 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail-With "npm install failed" }
  } else {
    Set-Status "Dependencies unchanged."
  }

  Set-Step "Building Raspberry (Rust compile - first build can take several minutes)"
  $buildLog = Join-Path $env:TEMP "raspberry-update-build.log"
  if (Test-Path $buildLog) { Remove-Item $buildLog -Force }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName  = "cmd.exe"
  $psi.Arguments = "/c npm run tauri:build > `"$buildLog`" 2>&1"
  $psi.WorkingDirectory = $RepoRoot
  $psi.WindowStyle = "Hidden"
  $psi.CreateNoWindow = $true
  $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)

  while (-not $proc.HasExited) {
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.Application]::DoEvents()
    if (Test-Path $buildLog) {
      $lastLine = (Get-Content $buildLog -Tail 1 -ErrorAction SilentlyContinue)
      if ($lastLine) { Set-Status ($lastLine.TrimEnd()) }
    }
  }
  if ($proc.ExitCode -ne 0) {
    $tailLog = ""
    if (Test-Path $buildLog) { $tailLog = (Get-Content $buildLog -Tail 10 | Out-String).Trim() }
    Fail-With "Build failed (exit $($proc.ExitCode)).`n$tailLog"
  }

  if (-not (Test-Path $ExePath)) {
    Fail-With "Build finished but exe missing at:`n$ExePath"
  }

  # Refresh desktop + Start Menu shortcuts so they always point at the freshly
  # built exe (safe to re-run; overwrites in place). If the shortcuts install
  # script is missing for any reason, don't fail the update - just skip.
  $shortcutScript = Join-Path $RepoRoot "scripts\Install-Shortcuts.ps1"
  if (Test-Path $shortcutScript) {
    Set-Step "Refreshing desktop shortcuts"
    try {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $shortcutScript 2>&1 | Out-Null
    } catch { }
  }

  Set-Step "Launching Raspberry"
  Start-Process -FilePath $ExePath
  Set-Status "Update complete. Raspberry is opening..."
  $progress.Style = "Blocks"
  $progress.Value = 100
  $closeBtn.Enabled = $true

  # Auto-close after 3s
  $autoclose = New-Object System.Windows.Forms.Timer
  $autoclose.Interval = 3000
  $autoclose.Add_Tick({ $autoclose.Stop(); $form.Close() })
  $autoclose.Start()
  [System.Windows.Forms.Application]::Run($form)
} catch {
  Fail-With "$_"
}

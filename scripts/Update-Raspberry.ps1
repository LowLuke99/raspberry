# Raspberry - one-click updater with a WinForms progress UI.
#
# Launched two ways:
#   1. Direct double-click on the "Update Raspberry" shortcut (via Update-Silent.vbs)
#      -> no console window, just the dark WinForms dialog
#   2. Debug mode: right-click .ps1 -> Run with PowerShell (console + dialog)
#
# Pipeline: single-instance lock -> close running app -> git pull ->
# npm install if deps changed -> tauri build --no-bundle -> refresh
# shortcuts -> launch fresh raspberry-hub.exe. Every step reports into the
# UI so the user sees progress instead of a mysterious silent process.
#
# NOTE: this file is intentionally pure ASCII. PowerShell 5.1 reads .ps1
# files in the system ANSI codepage, which mangles unicode em-dashes /
# arrows and turns them into parse errors. Keep it ASCII forever.

# Deliberately NOT "Stop": with $ErrorActionPreference = Stop, any git
# warning line (LF/CRLF conversion, detached HEAD, etc.) written to
# stderr becomes a NativeCommandError that gets caught by the outer
# try/catch and reported as "git pull failed" even though git exited 0.
# We check $LASTEXITCODE explicitly instead.
$ErrorActionPreference = "Continue"

$RepoRoot   = Split-Path $PSScriptRoot -Parent
$ExePath    = Join-Path $RepoRoot "target\release\raspberry-hub.exe"
$LogFile    = Join-Path $RepoRoot "update.log"
$IconPath   = Join-Path $RepoRoot "apps\hub\src-tauri\icons\icon.ico"
$LockFile   = Join-Path $env:TEMP "raspberry-updater.lock"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- single-instance lock ---------------------------------------------------
# Prevents a double-click on the "Update Raspberry" shortcut from spawning
# two concurrent updaters that race on the exe + temp build log.
$lockStream = $null
try {
  $lockStream = [System.IO.File]::Open(
    $LockFile,
    [System.IO.FileMode]::OpenOrCreate,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
} catch {
  [System.Windows.Forms.MessageBox]::Show(
    "Another Raspberry updater is already running.`n`nWait for it to finish, or delete:`n$LockFile",
    "Raspberry Updater",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  ) | Out-Null
  exit 0
}

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

function Release-Lock {
  if ($script:lockStream) {
    try { $script:lockStream.Close(); $script:lockStream.Dispose() } catch { }
    $script:lockStream = $null
  }
  if (Test-Path $LockFile) {
    try { Remove-Item $LockFile -Force -ErrorAction SilentlyContinue } catch { }
  }
}

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
  Release-Lock
  [System.Windows.Forms.Application]::Run($form)
  exit 1
}

# Run a native command, capture stdout+stderr to files, return exit code.
# Avoids the PowerShell 5.1 "stderr becomes NativeCommandError" trap that
# breaks 2>&1 when $ErrorActionPreference is Stop.
#
# NOTE: the parameter is named $Arguments, not $Args. $Args is a reserved
# automatic variable in every PowerShell function and the parser strips the
# `-Args` binding at the call site, silently leaving the parameter empty.
# That was the "ArgumentList null" crash before this fix.
function Invoke-Native {
  param(
    [string]$File,
    [string[]]$Arguments,
    [string]$WorkDir = $null
  )
  $stdoutFile = New-TemporaryFile
  $stderrFile = New-TemporaryFile
  try {
    $psi = @{
      FilePath              = $File
      NoNewWindow           = $true
      Wait                  = $true
      PassThru              = $true
      RedirectStandardOutput = $stdoutFile.FullName
      RedirectStandardError  = $stderrFile.FullName
    }
    # Start-Process refuses a null or empty -ArgumentList. Only pass the key
    # when the caller actually supplied arguments.
    if ($Arguments -and $Arguments.Count -gt 0) {
      $psi.ArgumentList = $Arguments
    }
    if ($WorkDir) { $psi.WorkingDirectory = $WorkDir }
    $proc = Start-Process @psi
    return [pscustomobject]@{
      ExitCode = $proc.ExitCode
      Stdout   = (Get-Content $stdoutFile.FullName -Raw -ErrorAction SilentlyContinue)
      Stderr   = (Get-Content $stderrFile.FullName -Raw -ErrorAction SilentlyContinue)
    }
  } finally {
    Remove-Item $stdoutFile.FullName -Force -ErrorAction SilentlyContinue
    Remove-Item $stderrFile.FullName -Force -ErrorAction SilentlyContinue
  }
}

function Stop-RaspberryProcesses {
  # Politely close windows first, then force-kill anything still standing.
  # Retry the force-kill loop until nothing is running or we hit the cap;
  # tauri build's WiX packaging is sensitive to a still-locked exe.
  Get-Process -Name "raspberry-hub","Raspberry" -ErrorAction SilentlyContinue | ForEach-Object {
    try { $_.CloseMainWindow() | Out-Null } catch { }
  }
  Start-Sleep -Milliseconds 600
  for ($i = 0; $i -lt 10; $i++) {
    $running = Get-Process -Name "raspberry-hub","Raspberry" -ErrorAction SilentlyContinue
    if (-not $running) { return }
    $running | ForEach-Object {
      try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
    Start-Sleep -Milliseconds 300
  }
}

# --- pipeline ---------------------------------------------------------------

try {
  Set-Step "Closing any running Raspberry window"
  Stop-RaspberryProcesses

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
  $headBefore = (Invoke-Native -File "git" -Arguments @("rev-parse","HEAD") -WorkDir $RepoRoot).Stdout.Trim()

  Set-Step "Pulling latest from GitHub"

  # Auto-stash any real local edits so a fast-forward pull can't be blocked
  # by a dirty tree. Uses porcelain output (no warnings) to decide.
  $statusRes = Invoke-Native -File "git" -Arguments @("status","--porcelain") -WorkDir $RepoRoot
  $stashed = $false
  if ($statusRes.Stdout -and $statusRes.Stdout.Trim()) {
    Set-Status "Local changes detected - stashing before pull."
    $stashRes = Invoke-Native -File "git" `
      -Arguments @("stash","push","-u","-m","raspberry-updater auto-stash $(Get-Date -Format o)") `
      -WorkDir $RepoRoot
    if ($stashRes.ExitCode -eq 0 -and $stashRes.Stdout -notmatch "No local changes to save") {
      $stashed = $true
    }
  }

  $pullRes = Invoke-Native -File "git" -Arguments @("pull","--ff-only") -WorkDir $RepoRoot
  if ($pullRes.ExitCode -ne 0) {
    if ($stashed) {
      Invoke-Native -File "git" -Arguments @("stash","pop") -WorkDir $RepoRoot | Out-Null
    }
    $errMsg = if ($pullRes.Stderr) { $pullRes.Stderr.Trim() } else { $pullRes.Stdout.Trim() }
    Fail-With "git pull failed (exit $($pullRes.ExitCode)): $errMsg"
  }
  if ($stashed) {
    Invoke-Native -File "git" -Arguments @("stash","pop") -WorkDir $RepoRoot | Out-Null
    Set-Status "Local changes restored on top of the pull."
  } else {
    $pullMsg = ($pullRes.Stdout + "`n" + $pullRes.Stderr).Trim()
    if ($pullMsg) {
      $tail = (($pullMsg -split "`n") | Where-Object { $_ -notmatch "^warning:" } | Select-Object -Last 3 | Out-String).Trim()
      if ($tail) { Set-Status $tail }
    }
  }

  $headAfter = (Invoke-Native -File "git" -Arguments @("rev-parse","HEAD") -WorkDir $RepoRoot).Stdout.Trim()
  $depsAfter = Get-DepsHash

  # Fast path: nothing changed AND the exe already exists -> just launch.
  if ($headBefore -eq $headAfter -and $depsBefore -eq $depsAfter -and (Test-Path $ExePath)) {
    Set-Step "Already up to date - launching"
    Set-Status "No new commits. Launching current build."
    Start-Process -FilePath $ExePath
    $progress.Style = "Blocks"
    $progress.Value = 100
    $closeBtn.Enabled = $true
    $autoclose = New-Object System.Windows.Forms.Timer
    $autoclose.Interval = 2000
    $autoclose.Add_Tick({ $autoclose.Stop(); $form.Close() })
    $autoclose.Start()
    [System.Windows.Forms.Application]::Run($form)
    Release-Lock
    exit 0
  }

  if ($depsBefore -ne $depsAfter) {
    Set-Step "Dependencies changed - running npm install"
    $npmRes = Invoke-Native -File "npm" -Arguments @("install","--no-audit","--no-fund") -WorkDir $RepoRoot
    if ($npmRes.ExitCode -ne 0) {
      Fail-With "npm install failed (exit $($npmRes.ExitCode)): $($npmRes.Stderr.Trim())"
    }
  } else {
    Set-Status "Dependencies unchanged."
  }

  # Back the current exe up before overwriting. If the build fails we
  # restore it so the user always has a working copy to launch.
  $BackupPath = "$ExePath.bak"
  $backedUp = $false
  if (Test-Path $ExePath) {
    try {
      Copy-Item -Path $ExePath -Destination $BackupPath -Force
      $backedUp = $true
    } catch {
      Set-Status "Warning: could not back up existing exe: $_"
    }
  }

  # One more kill sweep right before build; a fresh raspberry-hub could have
  # been spawned in the window between the initial kill and now.
  Stop-RaspberryProcesses

  Set-Step "Building Raspberry (Rust compile - first build can take several minutes)"
  $buildLog = Join-Path $env:TEMP "raspberry-update-build-$PID.log"
  if (Test-Path $buildLog) { Remove-Item $buildLog -Force -ErrorAction SilentlyContinue }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName  = "cmd.exe"
  # --no-bundle: skip WiX MSI packaging. It's slow and its `light.exe` step
  # locks target\release\raspberry-hub.exe, which is the exact cascade that
  # blew up prior update runs. We only need the exe for local use.
  $psi.Arguments = "/c npm run tauri:build:fast > `"$buildLog`" 2>&1"
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
    if (Test-Path $buildLog) { $tailLog = (Get-Content $buildLog -Tail 15 | Out-String).Trim() }
    if ($backedUp) {
      try {
        Copy-Item -Path $BackupPath -Destination $ExePath -Force
        Fail-With "Build failed (exit $($proc.ExitCode)). Previous exe restored.`n$tailLog"
      } catch {
        Fail-With "Build failed (exit $($proc.ExitCode)) AND rollback failed: $_`n$tailLog"
      }
    } else {
      Fail-With "Build failed (exit $($proc.ExitCode)).`n$tailLog"
    }
  }

  if (-not (Test-Path $ExePath)) {
    if ($backedUp) {
      Copy-Item -Path $BackupPath -Destination $ExePath -Force -ErrorAction SilentlyContinue
      Fail-With "Build finished but exe missing at:`n$ExePath`n(Previous exe restored.)"
    }
    Fail-With "Build finished but exe missing at:`n$ExePath"
  }

  # Refresh desktop + Start Menu shortcuts so they always point at the freshly
  # built exe (safe to re-run). If the shortcut script is missing, skip.
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
  Release-Lock
} catch {
  Fail-With "$_"
}

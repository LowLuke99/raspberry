//! Tiny helper: run a PowerShell one-liner and return stdout as a String.
//! Used by the security/storage/logs modules to talk to Windows APIs
//! without dragging in the whole WMI/COM stack. All calls are read-only.
//!
//! Non-Windows targets return an empty string so the same code compiles
//! everywhere (the modules just report empty results).

#[cfg(target_os = "windows")]
pub fn ps(script: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // 0x08000000 = CREATE_NO_WINDOW — keeps the tiny powershell console from
    // flashing up when we spawn it.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let out = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("failed to spawn powershell: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn ps(_script: &str) -> Result<String, String> {
    Ok(String::new())
}

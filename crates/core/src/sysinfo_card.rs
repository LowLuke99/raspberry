//! Sysinfo Card — wraps [fastfetch](https://github.com/fastfetch-cli/fastfetch),
//! a modern neofetch replacement.
//!
//! Rendering strategy: fastfetch's `--format json` gives us a structured tree of
//! every module. We normalize the parts we care about (kernel, uptime, WM, CPU,
//! GPU, memory, disk) into a flat list of `{ key, value }` rows the frontend
//! renders next to a big colored logo. The raw JSON also comes back so the UI
//! can show it verbatim in a "raw" tab.
//!
//! Bundling: fastfetch isn't shipped inside Raspberry. If it isn't on PATH the
//! response includes an `install_hint` and the panel shows a one-click copy
//! button for `winget install --id Fastfetch-cli.Fastfetch -e`.

use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct SysinfoRow {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct SysinfoCard {
    pub available: bool,
    pub version: Option<String>,
    pub rows: Vec<SysinfoRow>,
    /// Raw fastfetch JSON output, empty when unavailable. The panel uses this
    /// for the "raw" tab and for future extended modules we don't parse yet.
    pub raw_json: String,
    /// Winget one-liner when fastfetch isn't installed.
    pub install_hint: Option<String>,
}

#[cfg(target_os = "windows")]
fn version() -> Option<String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let out = Command::new("fastfetch")
        .arg("--version")
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    Some(text)
}

#[cfg(target_os = "windows")]
fn run_json() -> Option<String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let out = Command::new("fastfetch")
        .args(["--pipe", "--format", "json"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).to_string())
}

#[cfg(not(target_os = "windows"))]
fn version() -> Option<String> { None }
#[cfg(not(target_os = "windows"))]
fn run_json() -> Option<String> { None }

fn install_hint() -> String {
    "winget install --id Fastfetch-cli.Fastfetch -e".to_string()
}

/// Best-effort JSON walker: fastfetch prints an array of `{type, result}` entries.
/// We flatten the interesting ones into rows. Anything unrecognized is skipped —
/// the raw tab still has the full tree.
fn rows_from_json(json_text: &str) -> Vec<SysinfoRow> {
    use serde_json::Value;

    let value: Value = match serde_json::from_str(json_text) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let arr = match value.as_array() {
        Some(a) => a,
        None => return Vec::new(),
    };

    let mut rows: Vec<SysinfoRow> = Vec::new();
    for entry in arr {
        let module = entry
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let result = match entry.get("result") {
            Some(r) => r,
            None => continue,
        };
        match module {
            "OS" => push_string(&mut rows, "OS", result, &["prettyName", "name"]),
            "Host" => push_string(&mut rows, "Host", result, &["prettyName", "name", "family"]),
            "Kernel" => push_string(&mut rows, "Kernel", result, &["release", "name"]),
            "Uptime" => push_uptime(&mut rows, result),
            "Packages" => push_packages(&mut rows, result),
            "Shell" => push_string(&mut rows, "Shell", result, &["prettyName", "exeName"]),
            "Terminal" => push_string(&mut rows, "Terminal", result, &["prettyName", "exeName"]),
            "WM" => push_string(&mut rows, "WM", result, &["prettyName", "processName"]),
            "DE" => push_string(&mut rows, "DE", result, &["prettyName"]),
            "CPU" => push_cpu(&mut rows, result),
            "GPU" => push_gpu(&mut rows, result),
            "Memory" => push_memory(&mut rows, result),
            "Swap" => push_memory_labeled(&mut rows, "Swap", result),
            "Disk" => push_disks(&mut rows, result),
            "LocalIP" => push_string(&mut rows, "IP", result, &["ipv4", "ipv6"]),
            "Battery" => push_battery(&mut rows, result),
            _ => {}
        }
    }
    rows
}

fn push_string(rows: &mut Vec<SysinfoRow>, key: &str, v: &serde_json::Value, fields: &[&str]) {
    for f in fields {
        if let Some(s) = v.get(*f).and_then(|x| x.as_str()) {
            if !s.is_empty() {
                rows.push(SysinfoRow { key: key.to_string(), value: s.to_string() });
                return;
            }
        }
    }
}

fn push_uptime(rows: &mut Vec<SysinfoRow>, v: &serde_json::Value) {
    if let Some(secs) = v.get("uptime").and_then(|x| x.as_u64()) {
        rows.push(SysinfoRow { key: "Uptime".into(), value: fmt_uptime(secs) });
    }
}

fn fmt_uptime(secs: u64) -> String {
    let d = secs / 86_400;
    let h = (secs % 86_400) / 3600;
    let m = (secs % 3600) / 60;
    if d > 0 { format!("{d}d {h}h {m}m") }
    else if h > 0 { format!("{h}h {m}m") }
    else { format!("{m}m") }
}

fn push_packages(rows: &mut Vec<SysinfoRow>, v: &serde_json::Value) {
    if let Some(obj) = v.as_object() {
        let mut parts: Vec<String> = Vec::new();
        for (k, val) in obj {
            if let Some(n) = val.as_u64() {
                if n > 0 {
                    parts.push(format!("{n} ({k})"));
                }
            }
        }
        if !parts.is_empty() {
            rows.push(SysinfoRow { key: "Packages".into(), value: parts.join(", ") });
        }
    }
}

fn push_cpu(rows: &mut Vec<SysinfoRow>, v: &serde_json::Value) {
    let name = v.get("name").and_then(|x| x.as_str()).unwrap_or("");
    let cores = v.get("cores").and_then(|c| c.get("physical")).and_then(|x| x.as_u64());
    let threads = v.get("cores").and_then(|c| c.get("logical")).and_then(|x| x.as_u64());
    let base_ghz = v.get("frequency")
        .and_then(|f| f.get("base"))
        .and_then(|x| x.as_f64())
        .map(|mhz| mhz / 1000.0);
    let mut extras: Vec<String> = Vec::new();
    if let (Some(c), Some(t)) = (cores, threads) {
        extras.push(format!("{c}C/{t}T"));
    }
    if let Some(g) = base_ghz {
        extras.push(format!("{g:.2} GHz"));
    }
    let value = if extras.is_empty() {
        name.to_string()
    } else {
        format!("{name} @ {}", extras.join(", "))
    };
    if !value.trim().is_empty() {
        rows.push(SysinfoRow { key: "CPU".into(), value });
    }
}

fn push_gpu(rows: &mut Vec<SysinfoRow>, v: &serde_json::Value) {
    // fastfetch emits GPU as an array of objects
    if let Some(arr) = v.as_array() {
        for gpu in arr {
            let name = gpu.get("name").and_then(|x| x.as_str()).unwrap_or("");
            let vendor = gpu.get("vendor").and_then(|x| x.as_str()).unwrap_or("");
            if !name.is_empty() {
                let value = if vendor.is_empty() || name.starts_with(vendor) {
                    name.to_string()
                } else {
                    format!("{vendor} {name}")
                };
                rows.push(SysinfoRow { key: "GPU".into(), value });
            }
        }
    }
}

fn push_memory(rows: &mut Vec<SysinfoRow>, v: &serde_json::Value) {
    push_memory_labeled(rows, "Memory", v);
}
fn push_memory_labeled(rows: &mut Vec<SysinfoRow>, label: &str, v: &serde_json::Value) {
    let used = v.get("used").and_then(|x| x.as_u64()).unwrap_or(0);
    let total = v.get("total").and_then(|x| x.as_u64()).unwrap_or(0);
    if total == 0 { return; }
    let pct = (used as f64 / total as f64 * 100.0) as u64;
    rows.push(SysinfoRow {
        key: label.to_string(),
        value: format!("{} / {} ({pct}%)", human_bytes(used), human_bytes(total)),
    });
}

fn push_disks(rows: &mut Vec<SysinfoRow>, v: &serde_json::Value) {
    if let Some(arr) = v.as_array() {
        for d in arr {
            let mount = d.get("mountpoint").and_then(|x| x.as_str()).unwrap_or("");
            let used = d.get("bytesUsed").and_then(|x| x.as_u64()).unwrap_or(0);
            let total = d.get("bytesTotal").and_then(|x| x.as_u64()).unwrap_or(0);
            if total == 0 { continue; }
            let pct = (used as f64 / total as f64 * 100.0) as u64;
            rows.push(SysinfoRow {
                key: format!("Disk {mount}"),
                value: format!("{} / {} ({pct}%)", human_bytes(used), human_bytes(total)),
            });
        }
    }
}

fn push_battery(rows: &mut Vec<SysinfoRow>, v: &serde_json::Value) {
    let capacity = v.get("capacity").and_then(|x| x.as_f64()).unwrap_or(-1.0);
    let status = v.get("status").and_then(|x| x.as_str()).unwrap_or("");
    if capacity < 0.0 { return; }
    let mut val = format!("{capacity:.0}%");
    if !status.is_empty() { val.push_str(&format!(" · {status}")); }
    rows.push(SysinfoRow { key: "Battery".into(), value: val });
}

fn human_bytes(n: u64) -> String {
    let x = n as f64;
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    const TB: f64 = GB * 1024.0;
    if x >= TB { format!("{:.2} TiB", x / TB) }
    else if x >= GB { format!("{:.2} GiB", x / GB) }
    else if x >= MB { format!("{:.0} MiB", x / MB) }
    else if x >= KB { format!("{:.0} KiB", x / KB) }
    else { format!("{n} B") }
}

/// Public entry: returns the flat rows + raw JSON. Never errors — an install
/// hint is included when fastfetch isn't on PATH so the UI can guide setup.
pub fn card() -> SysinfoCard {
    let ver = version();
    let json_text = run_json().unwrap_or_default();
    let rows = rows_from_json(&json_text);
    let available = ver.is_some();
    SysinfoCard {
        available,
        version: ver,
        rows,
        raw_json: json_text,
        install_hint: if available { None } else { Some(install_hint()) },
    }
}

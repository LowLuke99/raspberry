//! Live network connection table (spec §10, Watchtower module).
//!
//! Enumerates every TCP endpoint on the machine — LISTEN + ESTABLISHED + the
//! full transient state set — using the Windows built-in `Get-NetTCPConnection`
//! cmdlet, then attributes each row to its owning process via `Get-Process`.
//! The join happens PowerShell-side in one shot so we only pay one process
//! spawn per refresh, no matter how many sockets are open.
//!
//! On non-Windows targets the whole thing returns empty so the crate still
//! compiles cross-platform.

use serde::Serialize;

use crate::winshell::ps;

/// One row in the live connection table.
#[derive(Serialize, Clone, Debug)]
pub struct NetConnection {
    /// "TCP" for now — UDP is stateless so we don't include it here.
    pub protocol: String,
    pub local_addr: String,
    pub local_port: u16,
    pub remote_addr: String,
    pub remote_port: u16,
    /// Get-NetTCPConnection State: Listen / Established / TimeWait / etc.
    pub state: String,
    /// True when local_addr is 0.0.0.0 / :: — bound to every interface.
    pub listen_any: bool,
    /// True when the remote is off-machine (not loopback, not unspecified).
    pub foreign: bool,
    pub pid: u32,
    /// Process name, best-effort — empty when the process died between the
    /// socket enumeration and the Get-Process join.
    pub process_name: String,
    /// Optional path to the executable — populated when we can read it.
    pub process_path: Option<String>,
}

/// The Watchtower snapshot. All TCP connections + summary counts. Returning
/// the counts pre-computed saves the frontend a second pass on every tick.
#[derive(Serialize, Clone, Debug)]
pub struct ConnectionSnapshot {
    pub connections: Vec<NetConnection>,
    pub total: u32,
    pub listening: u32,
    pub established: u32,
    pub foreign_hosts: u32,
    pub unique_processes: u32,
    /// True when PowerShell is available (i.e. Windows). Frontends key their
    /// "not-supported" empty state off this.
    pub supported: bool,
}

/// One shot: read every TCP endpoint, resolve pid → process. Returns an empty
/// snapshot with `supported = false` on non-Windows.
pub fn snapshot_connections() -> ConnectionSnapshot {
    #[cfg(not(target_os = "windows"))]
    {
        return ConnectionSnapshot {
            connections: Vec::new(),
            total: 0,
            listening: 0,
            established: 0,
            foreign_hosts: 0,
            unique_processes: 0,
            supported: false,
        };
    }

    // Get-NetTCPConnection returns the socket table; joining Get-Process on
    // OwningProcess gives us the process name + path in the same pipeline.
    // Selecting explicit properties + ConvertTo-Json ensures a stable schema.
    // Depth 3 is enough for the flat rows we return.
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'
$procs = @{}
Get-Process | ForEach-Object {
    $procs[[int]$_.Id] = @{
        Name = $_.Name
        Path = $_.Path
    }
}
$rows = Get-NetTCPConnection | ForEach-Object {
    $p = $procs[[int]$_.OwningProcess]
    [PSCustomObject]@{
        LocalAddress  = $_.LocalAddress
        LocalPort     = $_.LocalPort
        RemoteAddress = $_.RemoteAddress
        RemotePort    = $_.RemotePort
        State         = "$($_.State)"
        Pid           = [int]$_.OwningProcess
        ProcessName   = if ($p) { $p.Name } else { '' }
        ProcessPath   = if ($p -and $p.Path) { $p.Path } else { $null }
    }
}
if ($null -eq $rows) { '[]' } else { $rows | ConvertTo-Json -Depth 3 -Compress }
"#;

    let json = match ps(script) {
        Ok(s) if !s.trim().is_empty() => s,
        _ => {
            return ConnectionSnapshot {
                connections: Vec::new(),
                total: 0,
                listening: 0,
                established: 0,
                foreign_hosts: 0,
                unique_processes: 0,
                supported: true,
            }
        }
    };

    // ConvertTo-Json emits a single object (not an array) when there's exactly
    // one row — handle both cases.
    let trimmed = json.trim();
    let raw_values: Vec<serde_json::Value> = if trimmed.starts_with('[') {
        serde_json::from_str(trimmed).unwrap_or_default()
    } else if trimmed.starts_with('{') {
        serde_json::from_str::<serde_json::Value>(trimmed)
            .ok()
            .map(|v| vec![v])
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let mut connections: Vec<NetConnection> = Vec::with_capacity(raw_values.len());
    for v in raw_values {
        let local_addr = v
            .get("LocalAddress")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let local_port = v.get("LocalPort").and_then(|x| x.as_u64()).unwrap_or(0) as u16;
        let remote_addr = v
            .get("RemoteAddress")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let remote_port = v.get("RemotePort").and_then(|x| x.as_u64()).unwrap_or(0) as u16;
        let state = v
            .get("State")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let pid = v.get("Pid").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
        let process_name = v
            .get("ProcessName")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let process_path = v
            .get("ProcessPath")
            .and_then(|x| x.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let listen_any = local_addr == "0.0.0.0" || local_addr == "::";
        let foreign = is_foreign_host(&remote_addr);

        connections.push(NetConnection {
            protocol: "TCP".to_string(),
            local_addr,
            local_port,
            remote_addr,
            remote_port,
            state,
            listen_any,
            foreign,
            pid,
            process_name,
            process_path,
        });
    }

    // Deterministic order: Listen rows first (they're the interesting attack
    // surface), then Established grouped by process, then everything else.
    connections.sort_by(|a, b| {
        state_rank(&a.state)
            .cmp(&state_rank(&b.state))
            .then(
                a.process_name
                    .to_lowercase()
                    .cmp(&b.process_name.to_lowercase()),
            )
            .then(a.local_port.cmp(&b.local_port))
    });

    let total = connections.len() as u32;
    let listening = connections
        .iter()
        .filter(|c| c.state.eq_ignore_ascii_case("Listen"))
        .count() as u32;
    let established = connections
        .iter()
        .filter(|c| c.state.eq_ignore_ascii_case("Established"))
        .count() as u32;

    let mut hosts = std::collections::HashSet::new();
    for c in &connections {
        if c.foreign && !c.remote_addr.is_empty() {
            hosts.insert(c.remote_addr.clone());
        }
    }
    let foreign_hosts = hosts.len() as u32;

    let mut pids = std::collections::HashSet::new();
    for c in &connections {
        if c.pid != 0 {
            pids.insert(c.pid);
        }
    }
    let unique_processes = pids.len() as u32;

    ConnectionSnapshot {
        connections,
        total,
        listening,
        established,
        foreign_hosts,
        unique_processes,
        supported: true,
    }
}

/// True when the remote endpoint is on some other machine — anything that
/// isn't loopback, unspecified, or empty (Listen rows have empty remotes).
fn is_foreign_host(addr: &str) -> bool {
    if addr.is_empty() {
        return false;
    }
    if addr == "0.0.0.0" || addr == "::" || addr == "*" {
        return false;
    }
    if addr.starts_with("127.") || addr == "::1" {
        return false;
    }
    true
}

/// Rank for sorting: Listen rows come first, then Established, then anything
/// else in a stable alphabetical order. Lower = earlier.
fn state_rank(state: &str) -> u8 {
    match state.to_ascii_lowercase().as_str() {
        "listen" => 0,
        "established" => 1,
        "closewait" | "close_wait" => 2,
        "timewait" | "time_wait" => 3,
        _ => 4,
    }
}

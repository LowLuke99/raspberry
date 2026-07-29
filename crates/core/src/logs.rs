//! Windows Event Log reader — recent System / Application / Security events
//! (Security requires admin; fails gracefully). Uses PowerShell `Get-WinEvent`
//! so we don't have to touch the wevtapi C API.

use serde::{Deserialize, Serialize};

use crate::winshell::ps;

#[derive(Serialize, Clone, Debug)]
pub struct LogEvent {
    pub log: String,
    pub time: String,
    pub level: String, // "Critical" | "Error" | "Warning" | "Information" | "Verbose"
    pub id: i64,
    pub provider: String,
    pub message: String,
}

/// Read up to `max` events from a named log. `log` is one of "System",
/// "Application", "Security", or any other Windows log name.
pub fn read_events(log: &str, max: u32) -> Vec<LogEvent> {
    // Guard input: only allow simple log names to avoid injection into the PS
    // script we build below.
    if !log.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '/') {
        return Vec::new();
    }
    let max = max.clamp(1, 500);
    let script = format!(
        r#"
        try {{
            Get-WinEvent -LogName '{log}' -MaxEvents {max} -ErrorAction Stop |
            Select-Object @{{n='time';e={{$_.TimeCreated.ToString('o')}}}},
                          @{{n='level';e={{$_.LevelDisplayName}}}},
                          @{{n='id';e={{$_.Id}}}},
                          @{{n='provider';e={{$_.ProviderName}}}},
                          @{{n='message';e={{ if ($_.Message) {{ ($_.Message -split "`n")[0].Substring(0,[Math]::Min(400,($_.Message -split "`n")[0].Length)) }} else {{ '' }} }}}} |
            ConvertTo-Json -Compress -Depth 3
        }} catch {{ '[]' }}
        "#
    );
    let out = match ps(&script) {
        Ok(s) if !s.trim().is_empty() => s,
        _ => return Vec::new(),
    };
    let raw: serde_json::Value = match serde_json::from_str(&out) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let items = match raw {
        serde_json::Value::Array(a) => a,
        v @ serde_json::Value::Object(_) => vec![v],
        _ => return Vec::new(),
    };
    items
        .into_iter()
        .filter_map(|v| parse_event(v, log))
        .collect()
}

fn parse_event(v: serde_json::Value, log: &str) -> Option<LogEvent> {
    #[derive(Deserialize)]
    struct Raw {
        time: Option<String>,
        level: Option<String>,
        id: Option<i64>,
        provider: Option<String>,
        message: Option<String>,
    }
    let r: Raw = serde_json::from_value(v).ok()?;
    Some(LogEvent {
        log: log.to_string(),
        time: r.time.unwrap_or_default(),
        level: r.level.unwrap_or_else(|| "Information".to_string()),
        id: r.id.unwrap_or(0),
        provider: r.provider.unwrap_or_default(),
        message: r.message.unwrap_or_default(),
    })
}

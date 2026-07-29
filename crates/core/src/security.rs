//! Windows security surface: Defender status, Firewall profiles, UAC level,
//! BitLocker per-volume, and the last 20 installed hotfixes. All read-only —
//! nothing here mutates system state. Frontend never asks the user to change
//! settings, just shows the truth.

use serde::{Deserialize, Serialize};

use crate::winshell::ps;

#[derive(Serialize, Clone, Debug, Default)]
pub struct DefenderStatus {
    pub enabled: bool,
    pub realtime: bool,
    pub tamper_protection: bool,
    pub signature_age_days: i64,
    pub last_full_scan_days: i64,
    pub last_quick_scan_days: i64,
    pub engine_version: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct FirewallProfile {
    pub name: String,      // Domain | Private | Public
    pub enabled: bool,
    pub default_inbound: String,
    pub default_outbound: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct BitlockerVolume {
    pub mount: String,
    pub protection_status: String, // On | Off
    pub encryption_percent: f32,
    pub volume_status: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct HotFix {
    pub id: String,
    pub description: String,
    pub installed_on: String,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct SecuritySnapshot {
    pub defender: DefenderStatus,
    pub firewall: Vec<FirewallProfile>,
    pub bitlocker: Vec<BitlockerVolume>,
    pub hotfixes: Vec<HotFix>,
    pub uac_level: Option<i64>, // 0 = disabled, 2 = default, 5 = always notify
    pub warnings: Vec<String>,  // human-language summary lines for the panel banner
}

pub fn security_snapshot() -> SecuritySnapshot {
    let mut snap = SecuritySnapshot::default();

    // Defender
    if let Some(d) = fetch_defender() {
        snap.defender = d;
    }
    // Firewall profiles
    snap.firewall = fetch_firewall();
    // BitLocker (needs admin; blank if not)
    snap.bitlocker = fetch_bitlocker();
    // Hotfixes
    snap.hotfixes = fetch_hotfixes();
    // UAC
    snap.uac_level = fetch_uac();

    // Roll up simple warnings for the panel banner.
    if !snap.defender.enabled {
        snap.warnings.push("Windows Defender is disabled.".into());
    } else if !snap.defender.realtime {
        snap.warnings.push("Defender real-time protection is off.".into());
    }
    if snap.defender.signature_age_days > 7 {
        snap.warnings
            .push(format!("Defender signatures are {} days old.", snap.defender.signature_age_days));
    }
    let fw_off: Vec<_> = snap.firewall.iter().filter(|p| !p.enabled).map(|p| p.name.clone()).collect();
    if !fw_off.is_empty() {
        snap.warnings
            .push(format!("Firewall off on: {}.", fw_off.join(", ")));
    }
    if let Some(0) = snap.uac_level {
        snap.warnings.push("UAC (User Account Control) is disabled.".into());
    }

    snap
}

fn fetch_defender() -> Option<DefenderStatus> {
    let script = r#"
        try {
            $s = Get-MpComputerStatus
            $obj = [PSCustomObject]@{
                enabled = -not $s.AntivirusEnabled -eq $false
                realtime = $s.RealTimeProtectionEnabled
                tamper = $s.IsTamperProtected
                sig_days = $s.AntivirusSignatureAge
                full_days = if ($s.FullScanAge -eq $null) { -1 } else { $s.FullScanAge }
                quick_days = if ($s.QuickScanAge -eq $null) { -1 } else { $s.QuickScanAge }
                engine = $s.AMEngineVersion
            }
            $obj | ConvertTo-Json -Compress
        } catch { '{}' }
    "#;
    let out = ps(script).ok()?;
    #[derive(Deserialize)]
    struct Raw {
        enabled: Option<bool>,
        realtime: Option<bool>,
        tamper: Option<bool>,
        sig_days: Option<i64>,
        full_days: Option<i64>,
        quick_days: Option<i64>,
        engine: Option<String>,
    }
    let r: Raw = serde_json::from_str(out.trim()).ok()?;
    Some(DefenderStatus {
        enabled: r.enabled.unwrap_or(false),
        realtime: r.realtime.unwrap_or(false),
        tamper_protection: r.tamper.unwrap_or(false),
        signature_age_days: r.sig_days.unwrap_or(-1),
        last_full_scan_days: r.full_days.unwrap_or(-1),
        last_quick_scan_days: r.quick_days.unwrap_or(-1),
        engine_version: r.engine.unwrap_or_default(),
    })
}

fn fetch_firewall() -> Vec<FirewallProfile> {
    let script = r#"
        try {
            Get-NetFirewallProfile |
            Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction |
            ConvertTo-Json -Compress
        } catch { '[]' }
    "#;
    let out = match ps(script) {
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
        .filter_map(|v| {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Raw {
                Name: Option<serde_json::Value>,
                Enabled: Option<serde_json::Value>,
                DefaultInboundAction: Option<serde_json::Value>,
                DefaultOutboundAction: Option<serde_json::Value>,
            }
            let r: Raw = serde_json::from_value(v).ok()?;
            // Enabled comes as 1/0 or "True"/"False" depending on PS version.
            let enabled = match r.Enabled {
                Some(serde_json::Value::Bool(b)) => b,
                Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(0) != 0,
                Some(serde_json::Value::String(s)) => matches!(s.as_str(), "True" | "true" | "1"),
                _ => false,
            };
            Some(FirewallProfile {
                name: value_to_string(r.Name),
                enabled,
                default_inbound: value_to_string(r.DefaultInboundAction),
                default_outbound: value_to_string(r.DefaultOutboundAction),
            })
        })
        .collect()
}

fn fetch_bitlocker() -> Vec<BitlockerVolume> {
    let script = r#"
        try {
            Get-BitLockerVolume -ErrorAction Stop |
            Select-Object MountPoint, ProtectionStatus, EncryptionPercentage, VolumeStatus |
            ConvertTo-Json -Compress
        } catch { '[]' }
    "#;
    let out = match ps(script) {
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
        .filter_map(|v| {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Raw {
                MountPoint: Option<String>,
                ProtectionStatus: Option<serde_json::Value>,
                EncryptionPercentage: Option<f32>,
                VolumeStatus: Option<serde_json::Value>,
            }
            let r: Raw = serde_json::from_value(v).ok()?;
            Some(BitlockerVolume {
                mount: r.MountPoint.unwrap_or_default(),
                protection_status: match r.ProtectionStatus {
                    Some(serde_json::Value::Number(n)) => match n.as_i64() {
                        Some(1) => "On".into(),
                        Some(0) => "Off".into(),
                        Some(2) => "Unknown".into(),
                        _ => "?".into(),
                    },
                    Some(serde_json::Value::String(s)) => s,
                    _ => "?".into(),
                },
                encryption_percent: r.EncryptionPercentage.unwrap_or(0.0),
                volume_status: value_to_string(r.VolumeStatus),
            })
        })
        .collect()
}

fn fetch_hotfixes() -> Vec<HotFix> {
    let script = r#"
        try {
            Get-HotFix |
            Sort-Object InstalledOn -Descending |
            Select-Object -First 20 HotFixID, Description, InstalledOn |
            ConvertTo-Json -Compress
        } catch { '[]' }
    "#;
    let out = match ps(script) {
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
        .filter_map(|v| {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Raw {
                HotFixID: Option<String>,
                Description: Option<String>,
                InstalledOn: Option<serde_json::Value>,
            }
            let r: Raw = serde_json::from_value(v).ok()?;
            Some(HotFix {
                id: r.HotFixID.unwrap_or_default(),
                description: r.Description.unwrap_or_default(),
                installed_on: parse_date(r.InstalledOn),
            })
        })
        .collect()
}

fn parse_date(v: Option<serde_json::Value>) -> String {
    match v {
        Some(serde_json::Value::String(s)) => s,
        Some(serde_json::Value::Object(o)) => {
            // PowerShell serialises DateTime as { "value": "/Date(1234)/", "DateTime": "..." }
            o.get("DateTime")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default()
        }
        _ => String::new(),
    }
}

fn fetch_uac() -> Option<i64> {
    let script = r#"
        try {
            (Get-ItemProperty -Path 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Policies\System' -Name ConsentPromptBehaviorAdmin).ConsentPromptBehaviorAdmin
        } catch { -1 }
    "#;
    let out = ps(script).ok()?;
    out.trim().parse::<i64>().ok().filter(|v| *v >= 0)
}

fn value_to_string(v: Option<serde_json::Value>) -> String {
    match v {
        Some(serde_json::Value::String(s)) => s,
        Some(serde_json::Value::Number(n)) => n.to_string(),
        Some(serde_json::Value::Bool(b)) => b.to_string(),
        _ => String::new(),
    }
}

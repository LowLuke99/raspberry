//! Physical disk enumeration via PowerShell (`Get-PhysicalDisk`). Enriches the
//! volume/mount info sysinfo already gives us with SSD/HDD, model, and health.

use serde::{Deserialize, Serialize};

use crate::winshell::ps;

/// One physical drive (SSD, HDD, NVMe, USB stick — anything Windows sees).
#[derive(Serialize, Clone, Debug)]
pub struct PhysicalDisk {
    pub friendly_name: String,
    pub model: String,
    pub media_type: String, // "SSD" | "HDD" | "Unspecified"
    pub bus_type: String,   // "NVMe" | "SATA" | "USB" | ...
    pub size_bytes: u64,
    pub health: String,     // "Healthy" | "Warning" | "Unhealthy"
    pub operational_status: String,
    pub serial: String,
}

pub fn list_physical_disks() -> Vec<PhysicalDisk> {
    let script = r#"
        Get-PhysicalDisk |
        Select-Object FriendlyName, Model, MediaType, BusType, Size, HealthStatus, OperationalStatus, SerialNumber |
        ConvertTo-Json -Compress -Depth 3
    "#;
    let out = match ps(script) {
        Ok(s) if !s.trim().is_empty() => s,
        _ => return Vec::new(),
    };

    // PowerShell emits a bare object for a single-item result and an array
    // for multiple items — normalise both.
    let raw: serde_json::Value = match serde_json::from_str(&out) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let items = match raw {
        serde_json::Value::Array(a) => a,
        v @ serde_json::Value::Object(_) => vec![v],
        _ => return Vec::new(),
    };

    items.into_iter().filter_map(parse_disk).collect()
}

fn parse_disk(v: serde_json::Value) -> Option<PhysicalDisk> {
    #[derive(Deserialize)]
    #[allow(non_snake_case)]
    struct Raw {
        FriendlyName: Option<String>,
        Model: Option<String>,
        MediaType: Option<serde_json::Value>,
        BusType: Option<serde_json::Value>,
        Size: Option<u64>,
        HealthStatus: Option<serde_json::Value>,
        OperationalStatus: Option<serde_json::Value>,
        SerialNumber: Option<String>,
    }
    let r: Raw = serde_json::from_value(v).ok()?;
    Some(PhysicalDisk {
        friendly_name: r.FriendlyName.unwrap_or_default(),
        model: r.Model.unwrap_or_default(),
        media_type: enum_label(r.MediaType, MEDIA_TYPES),
        bus_type: enum_label(r.BusType, BUS_TYPES),
        size_bytes: r.Size.unwrap_or(0),
        health: enum_label(r.HealthStatus, HEALTH),
        operational_status: enum_label(r.OperationalStatus, OP_STATUS),
        serial: r.SerialNumber.unwrap_or_default().trim().to_string(),
    })
}

// PowerShell serialises some enums as strings, others as integers depending on
// system locale. Handle both.
fn enum_label(v: Option<serde_json::Value>, table: &[(u64, &str)]) -> String {
    match v {
        Some(serde_json::Value::String(s)) => s,
        Some(serde_json::Value::Number(n)) => {
            let i = n.as_u64().unwrap_or(0);
            table
                .iter()
                .find(|(k, _)| *k == i)
                .map(|(_, l)| (*l).to_string())
                .unwrap_or_else(|| i.to_string())
        }
        Some(serde_json::Value::Array(a)) => {
            // OperationalStatus can be an array of ints
            a.into_iter()
                .filter_map(|x| enum_label(Some(x), table).into())
                .collect::<Vec<String>>()
                .join(", ")
        }
        _ => String::new(),
    }
}

// Numeric enum tables from MSFT docs (kept short; unknowns fall through as the raw int).
const MEDIA_TYPES: &[(u64, &str)] = &[(0, "Unspecified"), (3, "HDD"), (4, "SSD"), (5, "SCM")];
const BUS_TYPES: &[(u64, &str)] = &[
    (0, "Unknown"), (1, "SCSI"), (3, "ATA"), (7, "USB"), (8, "SAS"), (11, "SATA"),
    (17, "NVMe"),
];
const HEALTH: &[(u64, &str)] = &[(0, "Healthy"), (1, "Warning"), (2, "Unhealthy"), (5, "Unknown")];
const OP_STATUS: &[(u64, &str)] = &[
    (0, "Unknown"), (2, "OK"), (3, "Degraded"), (4, "Stressed"), (5, "Predictive Failure"),
    (6, "Error"), (7, "Non-Recoverable Error"), (8, "Starting"), (9, "Stopping"),
    (10, "Stopped"), (11, "In Service"), (12, "No Contact"), (13, "Lost Communication"),
    (14, "Aborted"), (15, "Dormant"), (16, "Supporting Entity in Error"), (17, "Completed"),
    (18, "Power Mode"), (19, "Relocating"),
];

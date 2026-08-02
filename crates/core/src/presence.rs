//! Presence — persistent registry of every device seen on the LAN.
//!
//! LAN Manager's `scan_lan_deep` gives you a live snapshot: what's on the
//! /24 right now. Presence is the memory of it — every device ever seen,
//! first_seen, last_seen, per-device tag + alert flag. A background scheduler
//! calls [`record_scan`] every few minutes; the UI reads [`list_devices`]
//! and per-device [`sightings`] to render "who's on your WiFi and when."
//!
//! Storage lives at `%APPDATA%\Raspberry\presence.sqlite` (Windows) or
//! `~/.local/share/raspberry/presence.sqlite` (Unix). SQLite is bundled so
//! the Rust build doesn't depend on a system libsqlite.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::LanDevice;

/// One remembered device.
#[derive(Serialize, Clone, Debug)]
pub struct PresenceDevice {
    pub mac: String,
    pub ip: String,
    pub vendor: String,
    pub hostname: Option<String>,
    pub first_seen_ms: u64,
    pub last_seen_ms: u64,
    pub tag: Option<String>,
    pub alert_on: bool,
    /// True if this device was in the most recent scan.
    pub online: bool,
    /// Total number of sightings recorded (a rough "how often here").
    pub sighting_count: u64,
}

/// One point-in-time record of a device being reachable. Compact so a
/// year of 5-minute scans stays small.
#[derive(Serialize, Clone, Debug)]
pub struct Sighting {
    pub seen_at_ms: u64,
    pub ip: String,
    pub rtt_ms: Option<u32>,
}

/// Handle to the presence database. The Hub keeps one of these behind a
/// `Mutex` for the lifetime of the app.
pub struct Presence {
    conn: Mutex<Connection>,
}

impl Presence {
    /// Open (or create) the DB at the default OS location.
    pub fn open_default() -> Result<Self, String> {
        let path = default_db_path()?;
        Self::open(&path)
    }

    /// Open (or create) the DB at a specific path — handy for tests.
    pub fn open(path: &std::path::Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("presence dir: {e}"))?;
        }
        let conn = Connection::open(path).map_err(|e| format!("presence open: {e}"))?;
        init_schema(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Record one scan's devices. Upserts each `(mac, …)`, appends a
    /// sighting row, and marks everything not in this scan as offline.
    /// Returns the MAC addresses that were seen for the FIRST time in
    /// this scan — the caller can use these to fire a notification.
    pub fn record_scan(&self, devices: &[LanDevice]) -> Result<Vec<String>, String> {
        let now = now_ms();
        let mut conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let tx = conn
            .transaction()
            .map_err(|e| format!("presence tx: {e}"))?;

        // Every scan starts by marking every device offline; then anything in
        // this scan gets flipped back to online in the upsert. A device that
        // hasn't been seen since remains offline.
        tx.execute("UPDATE devices SET online = 0", [])
            .map_err(|e| format!("presence offline sweep: {e}"))?;

        let mut new_macs: Vec<String> = Vec::new();
        for d in devices {
            if d.mac.is_empty() {
                continue;
            }
            // Was this MAC known before this scan?
            let seen_before: bool = tx
                .query_row(
                    "SELECT 1 FROM devices WHERE mac = ?1",
                    params![&d.mac],
                    |_| Ok(true),
                )
                .optional()
                .map_err(|e| format!("presence exists check: {e}"))?
                .unwrap_or(false);

            if !seen_before {
                new_macs.push(d.mac.clone());
            }

            tx.execute(
                "INSERT INTO devices (mac, ip, vendor, hostname, first_seen_ms, last_seen_ms, online, sighting_count)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?5, 1, 1)
                 ON CONFLICT(mac) DO UPDATE SET
                     ip = excluded.ip,
                     vendor = CASE WHEN excluded.vendor <> '' THEN excluded.vendor ELSE vendor END,
                     hostname = COALESCE(excluded.hostname, hostname),
                     last_seen_ms = excluded.last_seen_ms,
                     online = 1,
                     sighting_count = sighting_count + 1",
                params![
                    &d.mac,
                    &d.ip,
                    &d.vendor,
                    &d.hostname,
                    now as i64,
                ],
            )
            .map_err(|e| format!("presence upsert: {e}"))?;

            tx.execute(
                "INSERT INTO sightings (mac, seen_at_ms, ip, rtt_ms) VALUES (?1, ?2, ?3, ?4)",
                params![&d.mac, now as i64, &d.ip, d.latency_ms.map(|v| v as i64)],
            )
            .map_err(|e| format!("presence sighting insert: {e}"))?;
        }

        tx.commit().map_err(|e| format!("presence commit: {e}"))?;
        Ok(new_macs)
    }

    /// Every remembered device, newest-last-seen first.
    pub fn list_devices(&self) -> Result<Vec<PresenceDevice>, String> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let mut stmt = conn
            .prepare(
                "SELECT mac, ip, vendor, hostname, first_seen_ms, last_seen_ms,
                        tag, alert_on, online, sighting_count
                   FROM devices
                  ORDER BY online DESC, last_seen_ms DESC",
            )
            .map_err(|e| format!("presence list prep: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(PresenceDevice {
                    mac: row.get(0)?,
                    ip: row.get(1)?,
                    vendor: row.get(2)?,
                    hostname: row.get(3)?,
                    first_seen_ms: row.get::<_, i64>(4)? as u64,
                    last_seen_ms: row.get::<_, i64>(5)? as u64,
                    tag: row.get(6)?,
                    alert_on: row.get::<_, i64>(7)? != 0,
                    online: row.get::<_, i64>(8)? != 0,
                    sighting_count: row.get::<_, i64>(9)? as u64,
                })
            })
            .map_err(|e| format!("presence list run: {e}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("presence list collect: {e}"))
    }

    /// All sightings for a MAC, oldest first, since `since_ms`.
    pub fn sightings(&self, mac: &str, since_ms: u64) -> Result<Vec<Sighting>, String> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let mut stmt = conn
            .prepare(
                "SELECT seen_at_ms, ip, rtt_ms
                   FROM sightings
                  WHERE mac = ?1 AND seen_at_ms >= ?2
                  ORDER BY seen_at_ms ASC",
            )
            .map_err(|e| format!("sightings prep: {e}"))?;
        let rows = stmt
            .query_map(params![mac, since_ms as i64], |row| {
                Ok(Sighting {
                    seen_at_ms: row.get::<_, i64>(0)? as u64,
                    ip: row.get(1)?,
                    rtt_ms: row.get::<_, Option<i64>>(2)?.map(|v| v as u32),
                })
            })
            .map_err(|e| format!("sightings run: {e}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("sightings collect: {e}"))
    }

    pub fn set_tag(&self, mac: &str, tag: Option<&str>) -> Result<(), String> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.execute(
            "UPDATE devices SET tag = ?1 WHERE mac = ?2",
            params![tag, mac],
        )
        .map_err(|e| format!("set_tag: {e}"))?;
        Ok(())
    }

    pub fn set_alert(&self, mac: &str, on: bool) -> Result<(), String> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.execute(
            "UPDATE devices SET alert_on = ?1 WHERE mac = ?2",
            params![on as i64, mac],
        )
        .map_err(|e| format!("set_alert: {e}"))?;
        Ok(())
    }

    /// Delete a device and every sighting for it. Reappears on next scan.
    pub fn forget(&self, mac: &str) -> Result<(), String> {
        let mut conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let tx = conn.transaction().map_err(|e| format!("forget tx: {e}"))?;
        tx.execute("DELETE FROM sightings WHERE mac = ?1", params![mac])
            .map_err(|e| format!("forget sightings: {e}"))?;
        tx.execute("DELETE FROM devices WHERE mac = ?1", params![mac])
            .map_err(|e| format!("forget devices: {e}"))?;
        tx.commit().map_err(|e| format!("forget commit: {e}"))
    }
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS devices (
            mac TEXT PRIMARY KEY,
            ip TEXT NOT NULL,
            vendor TEXT NOT NULL DEFAULT '',
            hostname TEXT,
            first_seen_ms INTEGER NOT NULL,
            last_seen_ms INTEGER NOT NULL,
            tag TEXT,
            alert_on INTEGER NOT NULL DEFAULT 0,
            online INTEGER NOT NULL DEFAULT 0,
            sighting_count INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS sightings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mac TEXT NOT NULL,
            seen_at_ms INTEGER NOT NULL,
            ip TEXT NOT NULL,
            rtt_ms INTEGER
         );
         CREATE INDEX IF NOT EXISTS idx_sightings_mac_time
             ON sightings(mac, seen_at_ms);",
    )
    .map_err(|e| format!("presence schema: {e}"))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn default_db_path() -> Result<PathBuf, String> {
    let base = if cfg!(windows) {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| "APPDATA not set".to_string())?
    } else {
        dirs_home()
            .ok_or_else(|| "no home dir".to_string())?
            .join(".local")
            .join("share")
    };
    Ok(base.join("Raspberry").join("presence.sqlite"))
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dev(mac: &str, ip: &str, host: Option<&str>) -> LanDevice {
        LanDevice {
            ip: ip.into(),
            mac: mac.into(),
            vendor: "Test".into(),
            kind: "test".into(),
            hostname: host.map(str::to_string),
            latency_ms: Some(3),
        }
    }

    fn tmp() -> Presence {
        use std::sync::atomic::{AtomicU64, Ordering};
        static N: AtomicU64 = AtomicU64::new(0);
        let n = N.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "raspberry-presence-test-{}-{}",
            std::process::id(),
            n
        ));
        let _ = std::fs::remove_dir_all(&dir);
        Presence::open(&dir.join("presence.sqlite")).expect("open")
    }

    #[test]
    fn first_scan_marks_every_mac_new() {
        let p = tmp();
        let new = p
            .record_scan(&[dev("aa:bb:cc:00:00:01", "10.0.0.2", Some("phone"))])
            .expect("record");
        assert_eq!(new.len(), 1);

        let list = p.list_devices().unwrap();
        assert_eq!(list.len(), 1);
        assert!(list[0].online);
        assert_eq!(list[0].sighting_count, 1);
        assert_eq!(list[0].hostname.as_deref(), Some("phone"));
    }

    #[test]
    fn second_scan_marks_missing_devices_offline() {
        let p = tmp();
        p.record_scan(&[
            dev("aa:bb:cc:00:00:01", "10.0.0.2", None),
            dev("aa:bb:cc:00:00:02", "10.0.0.3", None),
        ])
        .unwrap();
        p.record_scan(&[dev("aa:bb:cc:00:00:01", "10.0.0.2", None)])
            .unwrap();
        let list = p.list_devices().unwrap();
        let online: Vec<_> = list.iter().filter(|d| d.online).map(|d| &d.mac).collect();
        let offline: Vec<_> = list.iter().filter(|d| !d.online).map(|d| &d.mac).collect();
        assert_eq!(online.len(), 1);
        assert_eq!(offline.len(), 1);
    }

    #[test]
    fn tag_and_alert_persist() {
        let p = tmp();
        p.record_scan(&[dev("aa:bb:cc:00:00:01", "10.0.0.2", None)])
            .unwrap();
        p.set_tag("aa:bb:cc:00:00:01", Some("papa's phone")).unwrap();
        p.set_alert("aa:bb:cc:00:00:01", true).unwrap();
        let d = &p.list_devices().unwrap()[0];
        assert_eq!(d.tag.as_deref(), Some("papa's phone"));
        assert!(d.alert_on);
    }

    #[test]
    fn subsequent_scans_only_report_new_macs() {
        let p = tmp();
        p.record_scan(&[dev("aa:bb:cc:00:00:01", "10.0.0.2", None)])
            .unwrap();
        let new_second = p
            .record_scan(&[
                dev("aa:bb:cc:00:00:01", "10.0.0.2", None),
                dev("aa:bb:cc:00:00:02", "10.0.0.3", None),
            ])
            .unwrap();
        assert_eq!(new_second, vec!["aa:bb:cc:00:00:02"]);
    }

    #[test]
    fn forget_removes_device_and_sightings() {
        let p = tmp();
        p.record_scan(&[dev("aa:bb:cc:00:00:01", "10.0.0.2", None)])
            .unwrap();
        p.record_scan(&[dev("aa:bb:cc:00:00:01", "10.0.0.2", None)])
            .unwrap();
        p.forget("aa:bb:cc:00:00:01").unwrap();
        assert_eq!(p.list_devices().unwrap().len(), 0);
        assert_eq!(p.sightings("aa:bb:cc:00:00:01", 0).unwrap().len(), 0);
    }
}

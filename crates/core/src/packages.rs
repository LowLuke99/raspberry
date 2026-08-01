//! Packages — thin wrapper around Windows' built-in `winget` CLI.
//!
//! Read paths (list, search) are free to call. Install / uninstall / upgrade
//! are wrapped in `winget_action` so the frontend picks the exact package by
//! id and the agent never guesses. Every command runs with `--accept-*` flags
//! and `--disable-interactivity` so nothing prompts inside the spawned
//! console — that would hang the request.
//!
//! Non-Windows targets stub out to empty results so the workspace still builds
//! everywhere (`raspberry-agent` is Windows-only in practice; this keeps
//! `cargo check` on any host from erroring).

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Package {
    pub id: String,
    pub name: String,
    pub version: String,
    /// Only populated by `list_upgradable` — the version winget would install.
    pub available: Option<String>,
    /// Source moniker (`winget`, `msstore`, custom repo). Blank if unknown.
    pub source: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct PackageActionResult {
    pub ok: bool,
    pub exit_code: i32,
    /// Combined stdout+stderr trimmed to the first ~4 KB — enough for a toast.
    pub log: String,
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{Package, PackageActionResult};
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const MAX_LOG: usize = 4096;

    fn winget_capture(args: &[&str]) -> Result<(i32, String), String> {
        let out = Command::new("winget")
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("failed to spawn winget: {e}"))?;
        let mut buf = String::new();
        buf.push_str(&String::from_utf8_lossy(&out.stdout));
        if !out.stderr.is_empty() {
            buf.push('\n');
            buf.push_str(&String::from_utf8_lossy(&out.stderr));
        }
        Ok((out.status.code().unwrap_or(-1), buf))
    }

    /// Parse winget's fixed-column text output.
    ///
    /// winget refuses to emit machine-readable JSON for `list` / `search`
    /// (the `--output json` flag it advertises is import/export only), so we
    /// fall back to the column layout it prints for humans. The header row
    /// tells us where each column starts, then every non-blank line becomes
    /// a Package.
    fn parse_table(text: &str) -> Vec<Package> {
        let mut out: Vec<Package> = Vec::new();
        let mut lines = text
            .lines()
            .filter(|l| !l.trim().is_empty() && !l.trim().starts_with('-'));

        // Skip the noisy progress spinner glyphs winget prints before the header.
        let header = loop {
            match lines.next() {
                Some(l) if l.contains("Name") && l.contains("Id") => break l,
                Some(_) => continue,
                None => return out,
            }
        };

        let col_id = header.find("Id").unwrap_or(0);
        let col_version = header.find("Version").unwrap_or(header.len());
        let col_available = header.find("Available");
        let col_source = header.find("Source");

        for line in lines {
            if line.len() < col_version {
                continue;
            }
            let name = line[..col_id].trim().to_string();
            let id_end = col_version.min(line.len());
            let id = line[col_id..id_end].trim().to_string();
            if id.is_empty() {
                continue;
            }
            let version_end = col_available
                .or(col_source)
                .unwrap_or(line.len())
                .min(line.len());
            let version = line[col_version..version_end].trim().to_string();
            let available = col_available.and_then(|a| {
                let end = col_source.unwrap_or(line.len()).min(line.len());
                if a >= line.len() {
                    None
                } else {
                    let v = line[a..end].trim();
                    if v.is_empty() { None } else { Some(v.to_string()) }
                }
            });
            let source = col_source
                .and_then(|s| line.get(s..).map(|v| v.trim().to_string()))
                .unwrap_or_default();
            out.push(Package { id, name, version, available, source });
        }
        out
    }

    pub fn list_installed() -> Result<Vec<Package>, String> {
        let (_code, text) = winget_capture(&[
            "list",
            "--accept-source-agreements",
            "--disable-interactivity",
        ])?;
        Ok(parse_table(&text))
    }

    pub fn list_upgradable() -> Result<Vec<Package>, String> {
        let (_code, text) = winget_capture(&[
            "upgrade",
            "--include-unknown",
            "--accept-source-agreements",
            "--disable-interactivity",
        ])?;
        Ok(parse_table(&text).into_iter().filter(|p| p.available.is_some()).collect())
    }

    pub fn search(query: &str) -> Result<Vec<Package>, String> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }
        let (_code, text) = winget_capture(&[
            "search",
            query.trim(),
            "--accept-source-agreements",
            "--disable-interactivity",
        ])?;
        Ok(parse_table(&text))
    }

    fn action(verb: &str, id: &str) -> Result<PackageActionResult, String> {
        // Guard the id so a wild string can't inject flags. winget package ids
        // only contain letters, digits, dot, dash, underscore, plus.
        if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+')) {
            return Err(format!("invalid package id: {id:?}"));
        }
        let (code, log) = winget_capture(&[
            verb,
            "--id",
            id,
            "--exact",
            "--silent",
            "--accept-source-agreements",
            "--accept-package-agreements",
            "--disable-interactivity",
        ])?;
        let mut trimmed = log;
        if trimmed.len() > super::imp::MAX_LOG {
            trimmed.truncate(super::imp::MAX_LOG);
            trimmed.push_str("\n… (truncated)");
        }
        Ok(PackageActionResult { ok: code == 0, exit_code: code, log: trimmed })
    }

    pub fn install(id: &str) -> Result<PackageActionResult, String> { action("install", id) }
    pub fn uninstall(id: &str) -> Result<PackageActionResult, String> { action("uninstall", id) }
    pub fn upgrade(id: &str) -> Result<PackageActionResult, String> { action("upgrade", id) }

    pub fn upgrade_all() -> Result<PackageActionResult, String> {
        let (code, log) = winget_capture(&[
            "upgrade",
            "--all",
            "--include-unknown",
            "--silent",
            "--accept-source-agreements",
            "--accept-package-agreements",
            "--disable-interactivity",
        ])?;
        let mut trimmed = log;
        if trimmed.len() > MAX_LOG {
            trimmed.truncate(MAX_LOG);
            trimmed.push_str("\n… (truncated)");
        }
        Ok(PackageActionResult { ok: code == 0, exit_code: code, log: trimmed })
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    use super::{Package, PackageActionResult};
    pub fn list_installed() -> Result<Vec<Package>, String> { Ok(Vec::new()) }
    pub fn list_upgradable() -> Result<Vec<Package>, String> { Ok(Vec::new()) }
    pub fn search(_q: &str) -> Result<Vec<Package>, String> { Ok(Vec::new()) }
    pub fn install(_id: &str) -> Result<PackageActionResult, String> {
        Err("winget is Windows-only".into())
    }
    pub fn uninstall(_id: &str) -> Result<PackageActionResult, String> {
        Err("winget is Windows-only".into())
    }
    pub fn upgrade(_id: &str) -> Result<PackageActionResult, String> {
        Err("winget is Windows-only".into())
    }
    pub fn upgrade_all() -> Result<PackageActionResult, String> {
        Err("winget is Windows-only".into())
    }
}

pub use imp::{install, list_installed, list_upgradable, search, uninstall, upgrade, upgrade_all};

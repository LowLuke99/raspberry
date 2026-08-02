//! Path allowlist for the remote-agent file browser.
//!
//! The Hub can ask an authenticated agent to list any directory the agent
//! process can read. Without a policy that reaches down to the root of every
//! mounted drive — including things the operator likely didn't intend to
//! expose (BitLocker mount points, hidden USB drives, mapped network shares
//! the agent user has domain access to).
//!
//! The allowlist is a small set of prefixes computed on first use:
//! - The user's home dir (`%USERPROFILE%` / `$HOME`).
//! - Every OS drive root that currently exists (Windows: `C:\..Z:\`).
//!
//! On a request we canonicalize the incoming path and reject anything that
//! doesn't sit under one of the allowed prefixes. Canonicalization defuses
//! `..` traversal (`C:\Users\me\..\..\Windows\System32`).
//!
//! This is a `deny by default outside allowlist` policy — an authenticated
//! Hub can still see everything under `%USERPROFILE%` and any drive root,
//! which is what a "PC control panel" wants; but a paired Hub whose token
//! leaked can't pivot to `\\file-server\hr` just because the agent runs
//! under a domain account that has access.

use std::path::{Path, PathBuf};

/// Compute the default allowlist prefixes. Called once at agent startup.
pub fn default_allowlist() -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();

    if let Some(home) = home_dir_pathbuf() {
        out.push(home);
    }

    for root in drive_roots() {
        out.push(root);
    }

    out
}

fn home_dir_pathbuf() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

fn drive_roots() -> Vec<PathBuf> {
    if cfg!(windows) {
        ('C'..='Z')
            .map(|c| PathBuf::from(format!("{c}:\\")))
            .filter(|p| p.exists())
            .collect()
    } else {
        vec![PathBuf::from("/")]
    }
}

/// Result of an allowlist check. `Allowed(canonical)` gives the caller the
/// canonicalized form so the OS call and any log line use the same string.
#[derive(Debug, PartialEq, Eq)]
pub enum CheckResult {
    Allowed(PathBuf),
    Denied,
    NotFound,
}

/// Check whether `raw` is inside any allowlist prefix. Canonicalizes first
/// (resolves `..`, symlinks, case on Windows) before doing a prefix compare
/// against canonicalized allowlist entries.
pub fn check<P: AsRef<Path>>(raw: P, allowlist: &[PathBuf]) -> CheckResult {
    let raw = raw.as_ref();
    let canon = match std::fs::canonicalize(raw) {
        Ok(p) => p,
        Err(_) => return CheckResult::NotFound,
    };

    for prefix in allowlist {
        let Ok(prefix_canon) = std::fs::canonicalize(prefix) else {
            continue;
        };
        if canon.starts_with(&prefix_canon) {
            return CheckResult::Allowed(canon);
        }
    }
    CheckResult::Denied
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_path_under_allowlisted_prefix() {
        // The current dir is always under some canonicalizable prefix — use
        // the current dir itself as the allowlist and a subpath as the input.
        let cwd = std::env::current_dir().expect("cwd");
        let allowlist = vec![cwd.clone()];
        // Cargo.toml exists in every crate we test in.
        let inside = cwd.join("Cargo.toml");
        assert!(matches!(
            check(&inside, &allowlist),
            CheckResult::Allowed(_)
        ));
    }

    #[test]
    fn denies_path_outside_prefix() {
        let cwd = std::env::current_dir().expect("cwd");
        // The parent dir is not in the allowlist.
        let allowlist = vec![cwd.join("src")];
        let outside = cwd.join("Cargo.toml"); // one level above allowlist
        assert_eq!(check(&outside, &allowlist), CheckResult::Denied);
    }

    #[test]
    fn traversal_is_defused() {
        let cwd = std::env::current_dir().expect("cwd");
        let allowlist = vec![cwd.join("src")];
        // Try to escape via ..
        let sneaky = cwd.join("src").join("..").join("Cargo.toml");
        assert_eq!(check(&sneaky, &allowlist), CheckResult::Denied);
    }

    #[test]
    fn missing_path_reports_not_found() {
        let cwd = std::env::current_dir().expect("cwd");
        let allowlist = vec![cwd.clone()];
        let ghost = cwd.join("this-file-does-not-exist-12345.txt");
        assert_eq!(check(&ghost, &allowlist), CheckResult::NotFound);
    }
}

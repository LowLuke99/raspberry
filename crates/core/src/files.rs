use serde::Serialize;
use std::fs;
use std::time::UNIX_EPOCH;

/// One entry (file or directory) in a browsed folder.
#[derive(Serialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: Option<u64>,
}

/// List a directory's immediate children. Directories first, then case-
/// insensitive by name. Unreadable entries are skipped rather than failing
/// the whole listing.
pub fn list_dir(path: &str) -> Result<Vec<FileEntry>, String> {
    let read = fs::read_dir(path).map_err(|e| format!("{path}: {e}"))?;
    let mut out = Vec::new();

    for entry in read.flatten() {
        let Ok(meta) = entry.metadata() else { continue };
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);

        out.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: if meta.is_dir() { 0 } else { meta.len() },
            modified_ms,
        });
    }

    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

/// The current user's home directory (best effort, cross-platform).
pub fn home_dir() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string())
}

/// Available drive roots. On Windows, probes C:.. Z:; elsewhere returns "/".
pub fn list_roots() -> Vec<String> {
    if cfg!(windows) {
        ('C'..='Z')
            .map(|c| format!("{c}:\\"))
            .filter(|p| std::path::Path::new(p).exists())
            .collect()
    } else {
        vec!["/".to_string()]
    }
}

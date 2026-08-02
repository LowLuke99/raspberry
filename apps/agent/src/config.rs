//! Agent config lives at `%APPDATA%\Raspberry\agent.toml` (Windows) or
//! `~/.config/raspberry/agent.toml` (Unix). Auto-generated on first run with a
//! random 32-char hex token and the default port. Users can edit either freely.

use rand::Rng;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentConfig {
    /// Bearer token the Hub must present in every authenticated request.
    pub token: String,
    /// TCP port. Default 8848 — arbitrary but easy to remember.
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(skip)]
    pub path: PathBuf,
}

fn default_port() -> u16 {
    8848
}

impl AgentConfig {
    pub fn load_or_create() -> Result<Self, Box<dyn std::error::Error>> {
        let path = config_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if path.exists() {
            let text = std::fs::read_to_string(&path)?;
            let mut cfg: AgentConfig = toml::from_str(&text)?;
            cfg.path = path;
            return Ok(cfg);
        }
        let cfg = AgentConfig {
            token: random_token(),
            port: default_port(),
            path: path.clone(),
        };
        let text = toml::to_string_pretty(&cfg)?;
        std::fs::write(&path, text)?;
        Ok(cfg)
    }
}

fn config_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let base = dirs::config_dir().ok_or("no config dir")?;
    Ok(base.join("Raspberry").join("agent.toml"))
}

fn random_token() -> String {
    // 32 hex chars = 128 bits of entropy. Plenty for a LAN-scoped bearer.
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| {
            let n: u8 = rng.gen_range(0..16);
            std::char::from_digit(n as u32, 16).unwrap()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::random_token;
    use std::collections::HashSet;

    #[test]
    fn random_token_has_expected_shape() {
        let t = random_token();
        assert_eq!(t.len(), 32, "token must be 32 chars");
        assert!(
            t.chars()
                .all(|c| c.is_ascii_hexdigit() && !c.is_uppercase()),
            "token must be lowercase hex: {t}"
        );
    }

    #[test]
    fn random_tokens_are_unique_across_many_calls() {
        // 128 bits of entropy — collisions in 1_000 draws would be a bug.
        let mut seen = HashSet::new();
        for _ in 0..1_000 {
            assert!(seen.insert(random_token()));
        }
    }
}

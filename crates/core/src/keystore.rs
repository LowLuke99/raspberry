//! Encrypted API-key vault, backed by the OS credential manager.
//!
//! On Windows this hits DPAPI via the `keyring` crate — the same store Chrome
//! uses for saved passwords. Keys are scoped to the current Windows user and
//! never touch the Raspberry app's own disk state.
//!
//! Design decisions (see `docs/project-audit/OSINT-PLATFORM-ROADMAP.md`
//! §3.3):
//!
//! - **Typed slots.** `KeyProvider` enumerates every provider Raspberry
//!   integrates with. Plugin manifests declare which slots they need; the
//!   registry surfaces missing keys as a first-class UI state.
//! - **No plaintext export.** The vault exposes `has_key(provider)` publicly
//!   but `read_key(provider)` is only callable from Rust (Tauri command layer
//!   never returns the raw value to the frontend — it's read at request time
//!   and passed into the outbound `reqwest::Client`, so the webview never
//!   sees the secret).
//! - **Audit hook.** Every read/write goes through `AuditSink`; the default
//!   is a no-op, but a future forensic build can plug in a JSONL writer.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const SERVICE: &str = "raspberry";

/// Every third-party service Raspberry knows about. Adding a new one is a
/// one-line change here plus a manifest entry on the consuming plugin.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum KeyProvider {
    Shodan,
    Censys,
    Virustotal,
    Abuseipdb,
    OtxAlienvault,
    Securitytrails,
    Haveibeenpwned,
    Greynoise,
    Urlscan,
    Hunterio,
    Fullhunt,
}

impl KeyProvider {
    /// Stable slug used as the keyring entry name AND the JSON discriminant
    /// on the wire. Keep in sync with `ApiKeyProvider` in
    /// `apps/hub/src/modules/types.ts`.
    pub fn slug(&self) -> &'static str {
        match self {
            KeyProvider::Shodan => "shodan",
            KeyProvider::Censys => "censys",
            KeyProvider::Virustotal => "virustotal",
            KeyProvider::Abuseipdb => "abuseipdb",
            KeyProvider::OtxAlienvault => "otx-alienvault",
            KeyProvider::Securitytrails => "securitytrails",
            KeyProvider::Haveibeenpwned => "haveibeenpwned",
            KeyProvider::Greynoise => "greynoise",
            KeyProvider::Urlscan => "urlscan",
            KeyProvider::Hunterio => "hunterio",
            KeyProvider::Fullhunt => "fullhunt",
        }
    }

    pub fn all() -> &'static [KeyProvider] {
        &[
            KeyProvider::Shodan,
            KeyProvider::Censys,
            KeyProvider::Virustotal,
            KeyProvider::Abuseipdb,
            KeyProvider::OtxAlienvault,
            KeyProvider::Securitytrails,
            KeyProvider::Haveibeenpwned,
            KeyProvider::Greynoise,
            KeyProvider::Urlscan,
            KeyProvider::Hunterio,
            KeyProvider::Fullhunt,
        ]
    }
}

#[derive(Debug, thiserror::Error)]
pub enum KeystoreError {
    #[error("no key stored for {0:?}")]
    NotFound(KeyProvider),
    #[error("keyring backend error: {0}")]
    Backend(String),
}

impl From<keyring::Error> for KeystoreError {
    fn from(e: keyring::Error) -> Self {
        match e {
            keyring::Error::NoEntry => KeystoreError::Backend("no entry".into()),
            other => KeystoreError::Backend(other.to_string()),
        }
    }
}

/// Public status of one slot — safe to expose to the frontend. Deliberately
/// no `value` field; presence is what plugins need to render "connect" vs
/// "connected".
#[derive(Debug, Clone, Serialize)]
pub struct KeyStatus {
    pub provider: KeyProvider,
    pub present: bool,
}

/// Audit callback invoked on every read/write. Off by default. Wire in a
/// JSONL writer or `tracing` bridge here when a compliance build needs it.
pub trait AuditSink: Send + Sync {
    fn record(&self, event: &str, provider: KeyProvider);
}

struct NoopAudit;
impl AuditSink for NoopAudit {
    fn record(&self, _event: &str, _provider: KeyProvider) {}
}

pub struct Keystore {
    audit: Mutex<Box<dyn AuditSink>>,
}

impl Default for Keystore {
    fn default() -> Self {
        Self { audit: Mutex::new(Box::new(NoopAudit)) }
    }
}

impl Keystore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_audit_sink(&self, sink: Box<dyn AuditSink>) {
        if let Ok(mut guard) = self.audit.lock() {
            *guard = sink;
        }
    }

    fn entry(provider: KeyProvider) -> Result<keyring::Entry, KeystoreError> {
        Ok(keyring::Entry::new(SERVICE, provider.slug())?)
    }

    fn audit(&self, event: &'static str, provider: KeyProvider) {
        if let Ok(sink) = self.audit.lock() {
            sink.record(event, provider);
        }
    }

    /// Write (or overwrite) a key. Empty strings delete the slot instead of
    /// storing an empty value — the "clear" affordance in the UI just posts
    /// an empty string.
    pub fn write_key(&self, provider: KeyProvider, value: &str) -> Result<(), KeystoreError> {
        let entry = Self::entry(provider)?;
        if value.is_empty() {
            let _ = entry.delete_credential();
            self.audit("delete", provider);
            return Ok(());
        }
        entry.set_password(value)?;
        self.audit("write", provider);
        Ok(())
    }

    /// Read a key. Callable from Rust only — never expose the return value to
    /// the frontend. Use it inside a Tauri command that itself performs the
    /// outbound HTTP call, so the raw secret stays in the Rust process.
    pub fn read_key(&self, provider: KeyProvider) -> Result<String, KeystoreError> {
        let entry = Self::entry(provider)?;
        match entry.get_password() {
            Ok(v) => {
                self.audit("read", provider);
                Ok(v)
            }
            Err(keyring::Error::NoEntry) => Err(KeystoreError::NotFound(provider)),
            Err(e) => Err(e.into()),
        }
    }

    /// Presence-only check. Safe to expose to the frontend.
    pub fn has_key(&self, provider: KeyProvider) -> bool {
        Self::entry(provider)
            .and_then(|e| e.get_password().map_err(Into::into))
            .is_ok()
    }

    /// Roll up presence for every known slot — powers the Keystore UI panel.
    pub fn status_all(&self) -> Vec<KeyStatus> {
        KeyProvider::all()
            .iter()
            .copied()
            .map(|p| KeyStatus { provider: p, present: self.has_key(p) })
            .collect()
    }
}

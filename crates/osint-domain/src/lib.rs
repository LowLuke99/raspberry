//! Domain-intelligence providers for Raspberry's OSINT platform.
//!
//! Every capability in this crate implements the [`DomainProvider`] trait so
//! the workflow engine, the entity-typed command palette, and the Domain
//! Intel panel all consume providers through one interface. Adding a new
//! source (e.g. a new certificate-log aggregator, a paid RDAP mirror) is a
//! matter of implementing the trait — no shell wiring required.
//!
//! Providers here MUST be **passive** — no active recon. Active recon lives
//! in `crates/recon-wrappers` and is gated by the consent flow.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub mod dns;
pub mod rdap;
pub mod ct_logs;

/// Machine-readable classification for a provider's output kind. The
/// workflow engine uses this to enforce type-safe edges (spec:
/// `docs/WORKFLOW-FORMAT.md` §Validation rules).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EntityKind {
    Domain,
    Subdomain,
    Ip,
    Asn,
    Certificate,
    Url,
    Email,
    Service,
}

/// One evidence-bearing datum produced by a provider. Findings are the atomic
/// unit that everything downstream (report, entity graph, correlator)
/// consumes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub kind: EntityKind,
    /// The entity value in canonical form (lowercase hostnames, no trailing
    /// dot, IPs in RFC-5952 canonical form, etc.).
    pub value: String,
    /// Where this finding came from — provider id + optional source URL.
    pub source: String,
    /// Confidence in [0, 1]. 1.0 for direct-lookup providers, less for
    /// heuristic/derived findings.
    pub confidence: f32,
    /// Arbitrary structured detail — provider-specific.
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub detail: serde_json::Value,
}

impl Finding {
    pub fn new(kind: EntityKind, value: impl Into<String>, source: impl Into<String>) -> Self {
        Self {
            kind,
            value: value.into(),
            source: source.into(),
            confidence: 1.0,
            detail: serde_json::Value::Null,
        }
    }

    pub fn with_detail(mut self, detail: serde_json::Value) -> Self {
        self.detail = detail;
        self
    }

    pub fn with_confidence(mut self, confidence: f32) -> Self {
        self.confidence = confidence.clamp(0.0, 1.0);
        self
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("network error: {0}")]
    Network(String),
    #[error("provider returned non-success status: {0}")]
    Status(u16),
    #[error("parsing provider response failed: {0}")]
    Parse(String),
    #[error("rate limited by upstream")]
    RateLimited,
    #[error("timed out after {0:?}")]
    Timeout(Duration),
    #[error("other: {0}")]
    Other(String),
}

impl From<reqwest::Error> for ProviderError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            ProviderError::Timeout(Duration::from_secs(0))
        } else if let Some(status) = e.status() {
            ProviderError::Status(status.as_u16())
        } else {
            ProviderError::Network(e.to_string())
        }
    }
}

/// Any provider that takes a domain and yields findings. Kept synchronous-in
/// -interface via `async_trait` so implementations can freely await internally
/// without leaking their runtime choice to callers.
#[async_trait]
pub trait DomainProvider: Send + Sync {
    /// Stable id — matches the plugin manifest / workflow node `provider` field.
    fn id(&self) -> &'static str;

    /// Human-facing label for the UI.
    fn label(&self) -> &'static str;

    /// What kind of findings this provider emits. The workflow engine reads
    /// this to type-check edges.
    fn outputs(&self) -> &'static [EntityKind];

    /// Run against the given domain. Implementations must be idempotent and
    /// side-effect-free — no writes to disk, no active recon.
    async fn lookup(&self, domain: &str) -> Result<Vec<Finding>, ProviderError>;
}

/// Normalize a domain string to lowercase, trim trailing dot, strip scheme
/// if a URL was passed. The whole crate operates on canonical form so cache
/// keys and dedup logic stay honest.
pub fn canonicalize(input: &str) -> String {
    let trimmed = input.trim().trim_end_matches('.');
    let stripped = trimmed
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or(trimmed);
    stripped.to_ascii_lowercase()
}

/// Small helper to build a `reqwest::Client` with our platform defaults:
/// short timeout, sane UA, gzip on. Every provider in this crate uses this
/// so behavior stays consistent.
pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!("Raspberry-OSINT/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(15))
        .gzip(true)
        .build()
        .expect("building a reqwest::Client with static config never fails")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonicalize_strips_scheme_and_path() {
        assert_eq!(canonicalize("https://Google.com/search?q=x"), "google.com");
        assert_eq!(canonicalize("http://example.com."), "example.com");
        assert_eq!(canonicalize("  ExAmple.COM  "), "example.com");
    }

    #[test]
    fn finding_confidence_is_clamped() {
        let f = Finding::new(EntityKind::Domain, "example.com", "test").with_confidence(1.5);
        assert_eq!(f.confidence, 1.0);
        let f = Finding::new(EntityKind::Domain, "example.com", "test").with_confidence(-0.2);
        assert_eq!(f.confidence, 0.0);
    }
}

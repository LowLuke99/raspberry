//! Certificate Transparency provider — queries crt.sh's JSON API for every
//! cert ever issued for a given domain. Each unique SAN becomes a subdomain
//! finding. This is the single highest-signal subdomain-discovery source
//! that doesn't require an API key.

use async_trait::async_trait;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashSet;

use crate::{DomainProvider, EntityKind, Finding, ProviderError, canonicalize, http_client};

#[derive(Debug, Deserialize)]
struct CrtShEntry {
    #[serde(default)]
    name_value: String,
    #[serde(default)]
    issuer_name: String,
    #[serde(default)]
    not_before: String,
    #[serde(default)]
    not_after: String,
}

pub struct CtLogsProvider {
    client: reqwest::Client,
}

impl Default for CtLogsProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl CtLogsProvider {
    pub fn new() -> Self {
        Self { client: http_client() }
    }
}

#[async_trait]
impl DomainProvider for CtLogsProvider {
    fn id(&self) -> &'static str {
        "domain.ct-logs"
    }
    fn label(&self) -> &'static str {
        "Certificate Transparency (crt.sh)"
    }
    fn outputs(&self) -> &'static [EntityKind] {
        &[EntityKind::Subdomain, EntityKind::Certificate]
    }

    async fn lookup(&self, domain: &str) -> Result<Vec<Finding>, ProviderError> {
        let d = canonicalize(domain);
        // `%.` prefix asks crt.sh for wildcard/subdomain matches.
        let url = format!("https://crt.sh/?q=%25.{}&output=json", d);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(ProviderError::Status(resp.status().as_u16()));
        }
        let entries: Vec<CrtShEntry> = resp
            .json()
            .await
            .map_err(|e| ProviderError::Parse(e.to_string()))?;

        let mut seen: HashSet<String> = HashSet::new();
        let mut findings = Vec::new();

        for entry in &entries {
            // `name_value` is newline-separated SANs.
            for san in entry.name_value.split('\n') {
                let san = san.trim().trim_start_matches("*.").to_ascii_lowercase();
                if san.is_empty() || san == d {
                    continue;
                }
                // Only keep names actually rooted at the target domain.
                if !san.ends_with(&format!(".{}", d)) && san != d {
                    continue;
                }
                if seen.insert(san.clone()) {
                    findings.push(
                        Finding::new(EntityKind::Subdomain, san, "ct-logs:crt.sh")
                            .with_detail(json!({
                                "issuer": entry.issuer_name,
                                "not_before": entry.not_before,
                                "not_after": entry.not_after,
                            }))
                            .with_confidence(0.95),
                    );
                }
            }
        }

        Ok(findings)
    }
}

//! RDAP provider — the modern successor to WHOIS. Queries the IANA RDAP
//! bootstrap registry via `rdap.org`, which handles TLD → server routing
//! for us so this crate stays free of a hardcoded TLD→server map.

use async_trait::async_trait;
use serde_json::json;

use crate::{DomainProvider, EntityKind, Finding, ProviderError, canonicalize, http_client};

pub struct RdapProvider {
    client: reqwest::Client,
}

impl Default for RdapProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl RdapProvider {
    pub fn new() -> Self {
        Self { client: http_client() }
    }
}

#[async_trait]
impl DomainProvider for RdapProvider {
    fn id(&self) -> &'static str {
        "domain.rdap"
    }
    fn label(&self) -> &'static str {
        "RDAP / WHOIS"
    }
    fn outputs(&self) -> &'static [EntityKind] {
        &[EntityKind::Domain, EntityKind::Email]
    }

    async fn lookup(&self, domain: &str) -> Result<Vec<Finding>, ProviderError> {
        let d = canonicalize(domain);
        let url = format!("https://rdap.org/domain/{}", d);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(ProviderError::Status(resp.status().as_u16()));
        }
        let body: serde_json::Value = resp.json().await.map_err(|e| ProviderError::Parse(e.to_string()))?;

        let mut findings = Vec::new();

        // Registrar + status → summarized as a single Domain finding whose
        // detail carries the raw RDAP payload (so the UI can render whichever
        // fields it cares about without another round-trip).
        findings.push(
            Finding::new(EntityKind::Domain, d.clone(), format!("rdap:{}", url))
                .with_detail(json!({
                    "handle": body.get("handle"),
                    "status": body.get("status"),
                    "events": body.get("events"),
                    "entities_count": body.get("entities").and_then(|e| e.as_array()).map(|a| a.len()),
                })),
        );

        // Sniff email addresses out of the "entities" vCard array. RDAP's
        // shape is nested; we walk it defensively so a schema drift just
        // yields fewer findings rather than an error.
        if let Some(entities) = body.get("entities").and_then(|e| e.as_array()) {
            for ent in entities {
                let Some(vcard) = ent.get("vcardArray").and_then(|v| v.as_array()) else { continue };
                let Some(fields) = vcard.get(1).and_then(|f| f.as_array()) else { continue };
                for field in fields {
                    let Some(arr) = field.as_array() else { continue };
                    let Some(name) = arr.first().and_then(|v| v.as_str()) else { continue };
                    if name.eq_ignore_ascii_case("email") {
                        if let Some(email) = arr.get(3).and_then(|v| v.as_str()) {
                            findings.push(
                                Finding::new(EntityKind::Email, email, "rdap:vcard")
                                    .with_confidence(0.9),
                            );
                        }
                    }
                }
            }
        }

        Ok(findings)
    }
}

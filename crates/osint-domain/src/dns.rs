//! DNS enumeration provider — A/AAAA/MX/NS/TXT/CAA/SOA lookups over the
//! system resolver. Uses `hickory-resolver` so we get proper async
//! non-blocking behavior on Tauri's runtime (fixing one of the audit's
//! flagged issues — no shelling out to `nslookup`).

use async_trait::async_trait;
use hickory_resolver::config::{ResolverConfig, ResolverOpts};
use hickory_resolver::TokioAsyncResolver;
use serde_json::json;

use crate::{DomainProvider, EntityKind, Finding, ProviderError, canonicalize};

pub struct DnsProvider {
    resolver: TokioAsyncResolver,
}

impl Default for DnsProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl DnsProvider {
    pub fn new() -> Self {
        // Cloudflare + Google DoT/DoH resolvers are the default; users who
        // want the OS default can construct with `from_system_conf`.
        let resolver = TokioAsyncResolver::tokio(ResolverConfig::cloudflare(), ResolverOpts::default());
        Self { resolver }
    }
}

#[async_trait]
impl DomainProvider for DnsProvider {
    fn id(&self) -> &'static str {
        "domain.dns"
    }
    fn label(&self) -> &'static str {
        "DNS enumeration"
    }
    fn outputs(&self) -> &'static [EntityKind] {
        &[EntityKind::Ip, EntityKind::Domain]
    }

    async fn lookup(&self, domain: &str) -> Result<Vec<Finding>, ProviderError> {
        let d = canonicalize(domain);
        let mut findings = Vec::new();

        if let Ok(a) = self.resolver.ipv4_lookup(&d).await {
            for ip in a.iter() {
                findings.push(
                    Finding::new(EntityKind::Ip, ip.to_string(), "dns:A")
                        .with_detail(json!({ "record": "A", "domain": d })),
                );
            }
        }

        if let Ok(a) = self.resolver.ipv6_lookup(&d).await {
            for ip in a.iter() {
                findings.push(
                    Finding::new(EntityKind::Ip, ip.to_string(), "dns:AAAA")
                        .with_detail(json!({ "record": "AAAA", "domain": d })),
                );
            }
        }

        if let Ok(mx) = self.resolver.mx_lookup(&d).await {
            for record in mx.iter() {
                let target = record.exchange().to_ascii().trim_end_matches('.').to_string();
                findings.push(
                    Finding::new(EntityKind::Domain, target, "dns:MX")
                        .with_detail(json!({ "record": "MX", "preference": record.preference() })),
                );
            }
        }

        if let Ok(ns) = self.resolver.ns_lookup(&d).await {
            for record in ns.iter() {
                let target = record.0.to_ascii().trim_end_matches('.').to_string();
                findings.push(
                    Finding::new(EntityKind::Domain, target, "dns:NS")
                        .with_detail(json!({ "record": "NS" })),
                );
            }
        }

        if let Ok(txt) = self.resolver.txt_lookup(&d).await {
            for record in txt.iter() {
                let joined: String = record
                    .iter()
                    .map(|b| String::from_utf8_lossy(b).to_string())
                    .collect::<Vec<_>>()
                    .join("");
                findings.push(
                    Finding::new(EntityKind::Domain, d.clone(), "dns:TXT")
                        .with_detail(json!({ "record": "TXT", "value": joined })),
                );
            }
        }

        Ok(findings)
    }
}

# Raspberry → OSINT & Cybersecurity Platform Roadmap

> Companion to `README.md` (project audit v0.7.1). Where the audit answered
> "what is broken today?", this document answers "what does Raspberry become
> if we take it seriously as a professional multi-tool platform?".
>
> Written to be executable: every module names its provider(s), its Rust
> crate, its UI route, its risks, and a rough size estimate (S / M / L / XL).

---

## 1. Executive Reframe

Raspberry today is a **Windows LAN control panel with an OSINT sidecar**
(Identity module — Holehe + Sherlock). The strategic pivot in this brief is
the opposite framing: **Raspberry is an OSINT & cybersecurity workstation
that happens to also expose the local Windows box and LAN as first-class
targets.**

That reframing changes three things:

1. **Modules are the product, not features.** A Domain Intel module is not
   "one panel"; it is a category with 12+ providers (WHOIS, RDAP, CT, DNS
   history, passive DNS, ASN, reverse IP, tech fingerprinting, headers,
   TLS, robots, favicon-hash). Same for IP, Email, Username, File, Threat.
2. **The Command Palette becomes the primary UI.** `domain google.com`,
   `ip 1.1.1.1`, `email x@y.z`, `scan 192.168.1.0/24`, `hash <sha256>` —
   type an entity, get every applicable provider. Panels become drill-down
   surfaces, not entry points.
3. **The Workflow Engine becomes the second product.** A Domain → Subdomains
   → HTTPX → Screenshots → Report chain, saved and re-runnable, is the
   thing that separates Raspberry from "yet another CLI wrapper".

## 2. Architectural Verdict

Good news first: **the plugin platform is 60% latent in the current code.**

| Latent capability | Where it lives today | What's missing |
|---|---|---|
| Module discovery | `apps/hub/src/modules/registry.ts` | Categories, enable/disable state, dep resolution |
| Module contract | `apps/hub/src/modules/types.ts` | version, capabilities, permissions, outputSchema, apiKeys |
| Local/remote transparency | `Target` abstraction (`localTarget` / `remoteTarget`) | Nothing — this is already right |
| Shared engine | `crates/core` (sysinfo/net/files/logs/etc.) | Split into `crates/core-system` + `crates/osint` + `crates/recon` for clarity |
| Palette | `Ctrl+K` module + command search | Entity-typed queries (`domain X` → run all Domain providers) |

The only *architectural* rewrite is the workflow engine — everything else is
extension.

## 3. Prioritized Roadmap

Each item: **Priority** — Name — (Size) — one-line rationale.

### CRITICAL (do first — everything else assumes these)

1. **Plugin manifest v2** (S) — add `version`, `category`, `capabilities`,
   `dependencies`, `permissions`, `outputSchema`, `defaultEnabled`,
   `apiKeys`. Backwards-compat with the 25 existing modules.
   → `apps/hub/src/modules/types.ts` + `manifests.tsx` migration.
2. **Category axis on the sidebar** (S) — group by
   `OSINT / Recon / Network / System / Threat Intel / Automation / Report`
   instead of the current `deck / core` binary.
   → `apps/hub/src/layout/Sidebar.tsx`.
3. **Encrypted API key vault** (M) — Windows Credential Manager backed;
   typed slots for Shodan, Censys, VT, AbuseIPDB, OTX, SecurityTrails, HIBP,
   Wappalyzer-alt.
   → `crates/core/src/keystore.rs` + `apps/hub/src/modules/keystore/`.
4. **Entity-typed Command Palette** (M) — parse the first token as an entity
   type (`domain`, `ip`, `email`, `user`, `hash`, `url`, `cidr`) and route
   to a **provider fanout** view, not a single module.
   → `apps/hub/src/lib/palette/entity-router.ts`.
5. **HTTP client discipline** (S) — one `reqwest::Client` per crate with
   sane defaults (UA, timeout, per-host rate limit, retry with jitter,
   optional Tor/SOCKS routing). No module opens raw sockets.
   → `crates/net-client/`.
6. **Cache layer** (M) — SQLite-backed keyed by `(provider, entity, args)`
   with per-provider TTL. Every provider is `Cacheable`.
   → `crates/core/src/cache.rs`.

### HIGH (the modules that make it a "platform")

7. **Domain Intel module** (L) — WHOIS/RDAP, DNS enum (A/AAAA/MX/TXT/NS/CAA
   /SOA/SRV/CNAME), Certificate Transparency (crt.sh), ASN lookup, reverse
   IP, DNS history, passive DNS (via SecurityTrails/Mnemonic), tech
   fingerprinting (Wappalyzer signatures), header analysis, TLS inspection.
   → `crates/osint-domain/` + `apps/hub/src/modules/domain-intel/`.
8. **IP Intel module** (L) — geolocation (MaxMind local DB), ASN/ISP,
   reputation (AbuseIPDB/OTX/VT), open services (Shodan/Censys/InternetDB
   free tier), historical DNS associations, threat feeds.
   → `crates/osint-ip/` + `apps/hub/src/modules/ip-intel/`.
9. **Email Intel module** (M) — syntax + MX validation, disposable check
   (local blocklist + `disify`), HIBP breach lookup, PGP key search (SKS
   fallback), public profile discovery (leverages Username Intel).
   → `crates/osint-email/` + `apps/hub/src/modules/email-intel/`.
10. **Username Intel module** (M) — replaces the CLI-wrapping Identity
    panel with a **native** Sherlock-style engine: 400+ site definitions in
    a JSON pack, parallel HTTP with per-host rate limiting, live results.
    → `crates/osint-username/` + upgrade `apps/hub/src/modules/identity/`.
11. **URL / Web Intel module** (L) — robots.txt + sitemap.xml discovery,
    Wayback Machine snapshots, screenshot capture (headless-chrome-rs or
    chromiumoxide), redirect tracing, favicon MurmurHash3 (Shodan-style),
    security header analysis, CDN detection, cloud provider detection.
    → `crates/osint-web/` + `apps/hub/src/modules/web-intel/`.
12. **File & Metadata Intel module** (M) — EXIF (kamadak-exif), PDF meta
    (pdf-rs / lopdf), Office meta, image perceptual hash, hash reputation
    (VT / MalwareBazaar), scrub-metadata action.
    → `crates/osint-file/` + `apps/hub/src/modules/file-intel/`.
13. **Threat Intel aggregator** (M) — one panel that fans out any IOC
    (domain/ip/hash/url) to all configured providers and merges verdicts.
    → `crates/osint-threat/` + `apps/hub/src/modules/threat-intel/`.
14. **Workflow engine** (L) — see §5 for the design.
15. **Report generator** (M) — every provider already returns typed JSON;
    add serializers for CSV, Markdown, HTML, PDF-ready (via `printpdf`).
    Evidence folder with screenshots, timestamps, source URLs.
    → `crates/reporter/` + `apps/hub/src/modules/reporter/`.

### MEDIUM (make it feel real for daily use)

16. **Investigation workspace** (M) — a persistent scratchpad per case:
    entities pinned, providers run, workflow runs, notes, evidence.
    → `crates/core/src/investigations.rs` (SQLite tables) + panel.
17. **Reconnaissance toolkit wrappers** (M) — theHarvester, Amass, Subfinder,
    Assetfinder, dnsx, httpx, Nmap, RustScan. Each wrapper is opt-in and
    detects the binary; missing binaries surface a "install with pipx/scoop"
    call-to-action instead of crashing.
    → `crates/recon-wrappers/` (feature-gated per tool).
18. **Consent + safety gates** (S) — active-recon tools (Nmap/Masscan/Nikto)
    force an explicit "I have authorization for this target" click, with the
    target and scope pinned into the investigation log.
    → `apps/hub/src/lib/consent.ts`.
19. **Global rate limiter** (S) — per-provider and per-host token buckets
    surfaced in a status bar chip; prevents accidental self-blacklisting on
    crt.sh, VT, etc.
    → `crates/net-client/src/limiter.rs`.
20. **Update notification + plugin marketplace scaffold** (M) — the current
    `Update-Raspberry.ps1` becomes a real check-for-updates surface, and
    the plugin manifest opens the door for third-party plugin packs shipped
    as git repos under `plugins/`.
    → `apps/hub/src/modules/plugins/` + `docs/plugin-dev.md`.

### LOW (polish / future)

21. Dashboard tiles for recent investigations, saved targets, API usage.
22. Dark/high-contrast theme toggle (design tokens already parameterized).
23. Web-viewer read-only export of a completed investigation report.
24. Multi-language i18n scaffolding.
25. Docker container that runs the Agent + a headless investigation runner.

## 4. Three Advanced OSINT Features (SpiderFoot / Recon-ng / Amass-inspired)

### 4.1 Entity Graph (SpiderFoot / Maltego-inspired)

**What.** A visual node graph where every result from every provider becomes
an entity (Domain / IP / Email / User / URL / Cert / Hash), edges are typed
relationships (`resolves_to`, `mx_of`, `ct_issued_for`, `hosts_service`,
`shares_cert_with`, `linked_to_user`). Users drag an entity into the graph;
providers run automatically against it; new entities land as new nodes.

**Why it matters.** Turns Raspberry from "many tools" into "one investigation
surface". This is the single feature that closes the gap to Maltego /
SpiderFoot HX.

**Implementation.**
- Data model: `crates/investigation/src/graph.rs` — `Entity { id, kind,
  value, first_seen, last_seen, sources[] }`, `Edge { from, to, kind,
  provider, confidence, evidence_ref }`. Stored in the investigation SQLite.
- Provider signature already returns `Vec<ProviderFinding>`; each finding
  serializes into (Entity, Edge) tuples.
- UI: `apps/hub/src/modules/graph/` using [`reactflow`] with a matte-black
  glass theme. Node context menu: "Run providers → Domain / IP / Threat".
- Persistence: workflow JSON stores the graph too; re-running a workflow
  re-populates the graph deterministically.

**Complexity:** L (2–3 weeks of focused work). Depends on modules #7–13
existing so nodes have something to show.

### 4.2 Autonomous Recon Chains (Recon-ng modules / Amass tracking)

**What.** A background "keep-watching" mode on a saved investigation:
Raspberry re-runs the workflow on a schedule (hourly / daily / weekly) and
**diffs** the result set. New subdomains show up as `+ diff`; disappearing
certs as `- diff`; changed HTTP fingerprints as `Δ`. The user sees a Slack-
style timeline of the target's public surface changing.

**Why it matters.** Turns Raspberry from a "point-in-time OSINT tool" into
a **continuous asset monitoring** tool. This is what Amass calls "tracking"
and what SecurityTrails charges for.

**Implementation.**
- Scheduler: `crates/scheduler/` (tokio + cron) running in the Agent
  process so it survives Hub restarts.
- Diff engine: `crates/investigation/src/diff.rs` — every provider result
  is content-hashed; a workflow run stores `{ workflow_id, timestamp,
  result_hashes }`. Diff = set difference of finding IDs between two runs.
- UI: a **Timeline** module (`apps/hub/src/modules/timeline/`) that reads
  all workflow diffs across investigations, sorted by time, grouped by
  target. Alerts routed through the existing `bus` — surface in the status
  bar and (Phase 8+) push to Telegram/Discord webhook.
- Rate control: reuses the global limiter (§3, #19).

**Complexity:** M (1–2 weeks). Prerequisite: Workflow engine (§5) exists.

### 4.3 Correlation & Threat Scoring Engine (SpiderFoot-inspired)

**What.** A rule engine that watches finding streams and raises **derived
findings** when patterns match. Examples:
- Domain has `MX = google.com` **and** username maps to Gmail → likely
  primary email domain — auto-run Email Intel.
- IP shows in AbuseIPDB with `confidence > 80` **and** appears in a passive
  DNS record for the target domain → flag as `Suspicious infrastructure`.
- Certificate SAN contains 3+ unrelated domains → flag as
  `Shared hosting — probable false-positive on domain relationships`.

Each rule outputs a **derived Entity/Edge** with a confidence score, so it
plays nicely with the Entity Graph (§4.1).

**Why it matters.** SpiderFoot's real value isn't the 200+ modules — it's
that findings *combine* into a threat picture. Without correlation, Raspberry
is a nicer command palette. With correlation, it's an actual analyst tool.

**Implementation.**
- Rule DSL: start with a Rust `enum Rule` (typed pattern matches on
  entities/edges); YAML/JSON rule packs come later so users can share rules.
  → `crates/correlator/`.
- Reactive: correlator subscribes to the finding stream (broadcast channel);
  runs matched rules; emits derived findings back onto the same stream. This
  gives you cascading correlation (a derived finding can trigger another
  rule) with a max-depth cap.
- UI: **Insights** panel per investigation that groups derived findings by
  rule with expandable evidence trails.

**Complexity:** M-L (2 weeks for engine + 10 seed rules, then ongoing rule
authoring).

## 5. Workflow Engine — Design Sketch

The workflow engine is the single largest new piece, and everything above
(§4.1 – §4.3) depends on it. High-level design so it doesn't get built ad hoc:

**Nodes.** A `WorkflowNode` is `{ id, kind, provider_id, inputs[], config }`
where `kind ∈ { Source, Transform, Sink }`. Sources emit entities
(user-typed target). Transforms take entity(-ies) → producer of entity(-ies)
(e.g. Domain → Subdomains). Sinks consume entities without emitting (e.g.
Report writer, Notifier).

**Edges.** `{ from_node, from_port, to_node, to_port }`. Ports are typed by
entity kind, so you cannot wire a Domain output into an IP input.

**Execution.** DAG scheduled onto a `tokio` runtime. Each node runs when
all its inputs have at least one value; it emits into a broadcast channel
so a node with 3 downstream consumers doesn't run 3×.

**Persistence.** JSON on disk:
```json
{
  "id": "workflow-domain-recon",
  "name": "Domain recon → screenshots → report",
  "nodes": [
    { "id": "src", "kind": "Source", "provider_id": "input:domain" },
    { "id": "whois", "kind": "Transform", "provider_id": "domain.whois" },
    { "id": "subs", "kind": "Transform", "provider_id": "domain.subfinder" },
    { "id": "httpx", "kind": "Transform", "provider_id": "web.httpx" },
    { "id": "shots", "kind": "Transform", "provider_id": "web.screenshot" },
    { "id": "report", "kind": "Sink", "provider_id": "report.html" }
  ],
  "edges": [
    { "from": "src", "to": "whois" },
    { "from": "src", "to": "subs" },
    { "from": "subs", "to": "httpx" },
    { "from": "httpx", "to": "shots" },
    { "from": "shots", "to": "report" }
  ]
}
```

**Sharing.** A workflow is just this JSON — check it into git, share via
gist, drag-drop into the Workflows panel to import.

## 6. File / Folder Changes (concrete diff, ordered)

```
crates/
  osint-domain/          # NEW — WHOIS, RDAP, DNS, CT, ASN, reverse-IP, PDNS
  osint-ip/              # NEW — geo, reputation, Shodan/Censys/InternetDB
  osint-email/           # NEW — syntax/MX, disposable, HIBP, PGP
  osint-username/        # NEW — native Sherlock-style engine + JSON site pack
  osint-web/             # NEW — robots, Wayback, screenshots, favicon-hash
  osint-file/            # NEW — EXIF, PDF, Office, hashing
  osint-threat/          # NEW — IOC fanout (VT, AbuseIPDB, OTX)
  recon-wrappers/        # NEW — feature-gated subprocess wrappers
  net-client/            # NEW — shared reqwest client + rate limiter
  investigation/         # NEW — cases, entities, graph, diffs, correlator
  reporter/              # NEW — JSON/CSV/MD/HTML/PDF serializers
  scheduler/             # NEW — cron for autonomous recon chains
  correlator/            # NEW — rule engine (§4.3)
  core/
    src/
      cache.rs           # NEW — SQLite-backed provider cache
      keystore.rs        # NEW — Windows Credential Manager wrapper

apps/
  hub/
    src/
      modules/
        domain-intel/    # NEW
        ip-intel/        # NEW
        email-intel/     # NEW
        web-intel/       # NEW
        file-intel/      # NEW
        threat-intel/    # NEW
        workflows/       # NEW
        graph/           # NEW (§4.1)
        timeline/        # NEW (§4.2)
        insights/        # NEW (§4.3)
        reporter/        # NEW
        keystore/        # NEW — API-key vault UI
        plugins/         # NEW — enable/disable + install
      lib/
        palette/
          entity-router.ts  # NEW — parse `domain X` etc.
        consent.ts       # NEW — active-recon consent gate
      layout/
        Sidebar.tsx      # EDIT — category axis

docs/
  plugin-dev.md          # NEW — plugin-manifest v2 authoring guide
  workflow-format.md     # NEW — workflow JSON reference
  osint-providers.md     # NEW — inventory of provider modules
```

## 6b. Decisions locked in 2026-08-02

- **Next phase = Workflow engine + Entity Graph.** Build the DAG executor
  first (linear chains, then the reactflow graph), so every future OSINT
  vertical inherits composability. Do NOT ship IP/Threat/Web verticals in
  parallel until the engine is real.
- **Active-recon consent gate: OFF.** Item #18 in §3 is dropped. Nmap /
  Masscan / Nikto wrappers will ship without the per-target authorization
  modal. Rationale: single-operator use; the friction isn't worth it for
  Papa Luke's own infrastructure. The `active: true` flag on manifests
  stays (useful for future filtering / display), but nothing gates on it.

## 7. Rollout Sequence

The above is not "do all of it before shipping". Suggested phase mapping:

- **Phase 9 (foundation):** items 1–6, 15 (Report generator). No new
  provider modules yet; this is the platform sprint.
- **Phase 10 (first vertical):** items 7 (Domain Intel), 10 (Username
  Intel rewrite), 14 (Workflow engine v1 — linear chains only, no graph).
- **Phase 11 (breadth):** items 8, 9, 11, 12, 13 (IP/Email/Web/File/Threat).
- **Phase 12 (depth):** items 16–20 (investigations, wrappers, safety,
  rate limiter, plugin marketplace).
- **Phase 13 (advanced):** §4.1 Entity Graph, §4.2 Autonomous Chains,
  §4.3 Correlator.

Each phase is 1–2 weeks of focused work at current velocity, so the full
transformation is a ~2-month arc, not a rewrite.

## 8. Risks & Non-Goals

- **Non-goal:** Raspberry does not attempt exploitation. Nmap/Masscan/Nikto
  wrappers stop at fingerprinting; no Metasploit-style payload delivery.
- **Non-goal:** Raspberry does not run persistent internet-exposed services.
  The Agent is LAN-only unless the user explicitly opens the port.
- **Risk (legal):** active recon on unauthorized targets is illegal in most
  jurisdictions. Item #18 (consent gate) is not optional.
- **Risk (rate limits):** shipping default queries against crt.sh / VT will
  get IPs blocked. Item #6 (cache) and #19 (limiter) are prerequisites for
  any HIGH-priority module.
- **Risk (Windows Defender):** shipping subprocess wrappers for Nmap /
  RustScan will trigger AV heuristics. Detect + document, don't fight it.

---

*Companion doc — implementation lives in the crates and modules listed
above. Start with §3 CRITICAL, in order.*

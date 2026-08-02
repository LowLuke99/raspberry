# Project Audit & Improvement Roadmap

> Deep technical + product audit of Raspberry as of `v0.7.1` (commit `16fcde1`).
> This document is written to be actionable — every issue names the file, the
> risk, the fix, and a realistic time estimate.

---

## Executive Summary

Raspberry is a Tauri (React + Rust) matte-black-glass control panel for a
Windows PC and its LAN. In seven phases it has grown to **17 modules across
four sections**, a **shared `raspberry-core` Rust crate** that both the local
Hub and a remote Agent reuse, and a working **HTTP-based remote-agent
architecture** with hostname-scoped machine picker, live health probing, and a
persistent machine list.

Architecturally it is in genuinely good shape:

- One shared `crates/core` module powers both local Tauri commands and the
  remote HTTP agent — every read-only panel that works locally works remotely
  with no extra code.
- The frontend `Target` abstraction (`localTarget` / `mockTarget` /
  `remoteTarget`) lets modules stay ignorant of transport.
- A `ModuleRegistry` singleton with a `ModuleManifest` schema means the shell
  discovers modules through a single registration point — 80% of a plugin
  system is already latent in the code.
- Rust workspace is disciplined (`lto = true`, `codegen-units = 1`, `strip`,
  `panic = "abort"` on release), and TS is `strict` +
  `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.

The gaps are equally clear and mostly **not code quality** — they are the
things you skip while building fast:

1. **No tests anywhere.** No `tests/` dirs in Rust, no `*.test.*` /
   `*.spec.*` in the frontend. `.github/` contains only assets, no
   `workflows/` — nothing runs `cargo test`, `tsc`, or `cargo clippy` on push.
2. **Agent runs plaintext HTTP with a bearer token.** README calls this out
   for Phase 8, but any tcpdump on your LAN captures the token. Combined with
   `CorsLayer::permissive()`, the agent is more exposed than intended.
3. **`"csp": null` in `tauri.conf.json`.** CSP is explicitly disabled. Given
   the Hub renders process names, network peers, log lines, and remote agent
   responses, this is the "we're the only ones who touch it" pattern.
4. **Heavy blocking work in async Tauri handlers.** `security_status`,
   `network_info`, `files_list`, `logs_read` shell out to PowerShell /
   `arp` / native syscalls directly on Tauri's async runtime. Under load a
   Watchtower tick can stall the UI event loop.
5. **No caching / rate-limits.** Every `winget list` call re-executes
   `winget list` (5–10s). Every Watchtower refresh re-runs `Get-NetTCPConnection`.
6. **Frontend crash surface.** `.expect("monitor mutex poisoned")` and
   friends in `apps/hub/src-tauri/src/lib.rs` — one panic anywhere poisons the
   mutex and every subsequent Tauri call panics until restart.

None of these is a code emergency — they are what the roadmap now needs to
work through before the surface grows further. **Phase 8 (hardening) should be
promoted from "next" to "before any Phase 8+ module ships."**

---

## Current Strengths

**Architecture / code**
- Clean workspace: `crates/core` (shared systems layer), `apps/hub` (Tauri),
  `apps/agent` (HTTP daemon).
- `raspberry-core` re-exports a single flat surface — every consumer imports
  from one place, no deep module paths.
- `Target` interface with three implementations (`local` / `mock` / `remote`)
  cleanly decouples panels from transport. Same React component drives Tauri
  IPC and cross-LAN HTTP.
- Module manifest + `ModuleRegistry` is the right abstraction for a
  plugin/marketplace pivot.
- Rust release profile is production-tuned (`lto`, `codegen-units = 1`,
  `strip`, `panic = "abort"`, `opt-level = "s"`).
- Constant-time token comparison (`ct_eq` in `apps/agent/src/main.rs`) — a
  detail most projects skip.
- `hidden_command()` in `crates/core/src/net.rs` sets `CREATE_NO_WINDOW` on
  every child process — small thing, huge polish (no cmd flash on `/24`
  scans).
- TypeScript is genuinely strict: `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`.
- `MockTarget` allows the whole UI to render in a browser preview without a
  running Tauri host — great for design iteration.
- Read-only-by-default philosophy for remote agents. Mutations are
  Hub-local until mTLS lands — the right call.

**Product / UX**
- 17 modules in a coherent visual system; each one does one thing well.
- Command palette (`Ctrl+K`) now surfaces machine-switch entries — muscle
  memory across machines.
- Live agent health chip (5s `/health` probe, RTT color-coded) is a
  polished detail that most self-hosted tools skip.
- One-click updater (`scripts/Update-Raspberry.ps1`) with a dark WinForms
  dialog — makes daily use zero-terminal.
- Desktop shortcuts (`Install-Raspberry.bat`) + silent VBS launcher — real
  app-like experience.
- Docs are well-organized (`SETUP.md`, `UPDATING.md`, `MODULES.md`,
  `AGENT.md`, `TROUBLESHOOTING.md`, `PHASE-7.md`).
- Real integrations, not clones: LocalSend v2 protocol, System Informer
  actions, ChrisTitusTech's winutil commands, fastfetch JSON, Sherlock +
  Holehe OSINT — each module wraps a real, battle-tested tool.

---

## Critical Issues

Each item is graded **What is wrong · Why it matters · Impact · Difficulty ·
Time · How to fix**.

### C-1  Agent traffic is plaintext HTTP with a static bearer token

- **What:** `apps/agent/src/main.rs` binds `0.0.0.0:8848` over plain HTTP.
  The token is sent in the `Authorization` header on every call and stored
  in cleartext at `%APPDATA%\Raspberry\agent.toml` and in the Hub's
  `localStorage` via `zustand/persist`.
- **Why it matters:** Anyone with packet capture on the LAN (a compromised
  Wi-Fi router, a promiscuous adapter, a badly-configured guest VLAN) can
  read the token in the clear, then impersonate the Hub. `/health` is
  unauthenticated by design, but every other endpoint (processes, files,
  logs, network) leaks its bearer as soon as the Hub calls it.
- **Impact:** Any authenticated caller can enumerate every file the agent
  process can read (`/files_list` has no path allowlist), the full process
  table, event logs, and every OS install/upgrade history.
- **Difficulty:** Medium. **Time:** 1–2 days (already scoped as Phase 8).
- **Fix:**
  1. Add `rustls` + `axum-server` with a self-signed cert generated on first
     run (or use `rcgen` to mint one). Store cert + key alongside
     `agent.toml`.
  2. Print the SHA-256 fingerprint on agent startup; the pairing flow shows
     the fingerprint and the Hub pins it on first connect (TOFU).
  3. Optional: add mTLS — Hub gets a client cert, agent verifies it. This is
     the strongest posture and matches Portainer's model.
  4. Tighten `CorsLayer::permissive()` — the agent only ever answers the
     Hub, so `CorsLayer::new().allow_origin(Any)` isn't needed. Set an
     explicit allow-list, or drop CORS entirely (Tauri isn't a browser
     origin).

### C-2  Zero automated tests, zero CI

- **What:** `find . -name '*.test.*' -o -name '*.spec.*'` returns nothing.
  No `tests/` dir in any Rust crate. `.github/` contains only `assets/`,
  no `workflows/`. `npm run build` runs `tsc --noEmit && vite build` — TS
  compile is the only check.
- **Why it matters:** 2,820 lines of Rust across `core` / `agent` / `hub`
  plus a full React UI, all shipped without a single unit test or CI gate.
  A regression in `scan_lan_deep`, `security_snapshot`, or the packages
  parser lands directly in production.
- **Impact:** Every phase increases the untested surface area. The winget
  parser (`crates/core/src/packages.rs`) parses fixed-column text — this
  is exactly the kind of thing that silently breaks on a Windows update.
- **Difficulty:** Medium. **Time:** 2–3 days for a real baseline.
- **Fix:**
  1. Add `.github/workflows/ci.yml` running on `windows-latest`:
     `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`,
     `npm ci && npm run build`.
  2. Unit-test the pure/parseable pieces first — winget output parser,
     OUI lookup, MAC / IP parsing, `ct_eq` (this one especially — a broken
     constant-time compare defeats C-1's fix), token generation, file
     listing sort order.
  3. Integration tests for the agent: spin up the router with a fake
     `Monitor`, hit `/health` (should be 200), `/snapshot` without a token
     (should be 401), `/snapshot` with a wrong-length token (still 401), a
     known-good token (200 + JSON shape check).
  4. Frontend: add `vitest` + `@testing-library/react`; smoke-test the
     module registry, target-switching side-effects, and the `matchCommands`
     search.

### C-3  CSP is explicitly disabled in Tauri

- **What:** `apps/hub/src-tauri/tauri.conf.json` sets `"security": { "csp": null }`.
- **Why it matters:** The Hub renders untrusted-adjacent data — process
  names (user-controlled if the user launches something weird), event log
  message bodies, remote agent JSON, LAN device hostnames returned by
  reverse DNS. Any XSS in a panel becomes RCE in the Tauri context because
  Tauri lets the webview call `invoke("process_kill", ...)`.
- **Impact:** Real. A malicious device hostname (`<img
  src=x onerror="__TAURI__.invoke('process_kill',{pid:4})">`) rendered
  unescaped could kill arbitrary processes.
- **Difficulty:** Low. **Time:** 2–4 hours.
- **Fix:** Set a strict CSP:
  ```json
  "security": {
    "csp": "default-src 'self'; connect-src 'self' https: http://192.168.*.*:*; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:"
  }
  ```
  Then audit every `dangerouslySetInnerHTML` (grep says there shouldn't be
  any, but confirm). Where user data is rendered, it goes through React's
  default text-escaping — good — but review any interpolation into `href`,
  `src`, `srcdoc`, or SVG attributes.

### C-4  Blocking OS work on Tauri's async runtime

- **What:** `apps/hub/src-tauri/src/lib.rs` — `system_snapshot`,
  `process_list`, `process_kill`, `files_list`, `files_home`,
  `files_roots`, `network_info`, `network_scan`, `storage_disks`,
  `security_status`, `logs_read` are all `fn` (not `async fn`) or `async
  fn` without a `spawn_blocking`. They execute inline on the Tauri command
  worker. `security_status` alone kicks off 4–5 PowerShell processes.
- **Why it matters:** A slow `security_snapshot` (~1–3s in practice, longer
  on cold PowerShell) blocks the command worker, which stalls the next
  `system_snapshot` tick, which the top bar polls every second. Under
  Watchtower load (1s TCP-connection refresh) this becomes visible jank.
- **Impact:** UI stutter, missed ticks, occasional multi-second freezes on
  cold caches.
- **Difficulty:** Low. **Time:** 3–5 hours.
- **Fix:** Wrap every OS-touching command in
  `tauri::async_runtime::spawn_blocking` (the packages and network-deep
  handlers already do this correctly — copy that pattern to the rest).
  Example refactor in `lib.rs:105-108`:
  ```rust
  #[tauri::command]
  async fn security_status() -> SecuritySnapshot {
      tauri::async_runtime::spawn_blocking(security_snapshot)
          .await
          .unwrap_or_default()
  }
  ```

### C-5  `.expect("monitor mutex poisoned")` is a foot-loaded shotgun

- **What:** `apps/hub/src-tauri/src/lib.rs` — every command that touches
  `state.monitor` calls `.expect("monitor mutex poisoned")`. If `sysinfo`
  ever panics inside `refresh_all` (it has, historically, on WSL and on
  some hyper-V configs), the mutex is poisoned forever — every subsequent
  Tauri call panics until the user restarts the app.
- **Why it matters:** Silent-until-catastrophic. The user sees "Raspberry
  is broken" with no error message.
- **Impact:** Medium. Uncommon trigger, but complete availability loss
  when it happens.
- **Difficulty:** Low. **Time:** 1 hour.
- **Fix:** Replace `.expect(...)` with `.unwrap_or_else(|e| e.into_inner())`
  (accept the poisoned state and continue — for a per-tick sample this is
  correct), or convert commands to return `Result<T, String>` and surface
  the error to the UI as a warning banner.

---

## High Priority Improvements

### H-1  No structured logging on the Hub side

`apps/agent` uses `tracing` + `tracing-subscriber` correctly. `apps/hub/src-tauri`
has zero logging — errors are `.expect()`'d or silently ignored. Add
`tauri-plugin-log` (writes to `%APPDATA%\Raspberry\logs\`), route Rust `log!`
calls through it, and mirror the tracing pattern from the agent. **~4h.**

### H-2  Agent has no path allowlist on `/files_list`

`apps/agent/src/main.rs:238` calls `list_dir(&q.path)` with no
sanitization or allowlist. A paired Hub (or an attacker who read the
token) can browse everywhere the agent process can — including
`C:\Windows\System32`, `%USERPROFILE%\Documents`, etc. Add a config-driven
allowlist (default: `%USERPROFILE%`, `C:\`, `D:\`) and reject anything
outside via canonical-path prefix check. **~2h.**

### H-3  No unbounded-list guards

`/processes`, `/files_list`, `/network_scan`, `/logs/:log/:max` all return
unbounded arrays. A single call to `/logs/System/1000000` will happily
serialize a million events. Add hard caps (max 5,000 rows per response)
and pagination for anything user-facing. **~3h.**

### H-4  Winget output parser is a fragility bomb

`crates/core/src/packages.rs` parses fixed-column PowerShell text.
Microsoft breaks this format across winget releases (real, has happened
multiple times). Add snapshot tests with recorded outputs for winget 1.6 /
1.7 / 1.8, and switch to `winget --json` where the subcommand supports it
(`export` / `install --json`). For `list` / `search` which have no JSON
mode, keep parsing but tolerate column-order changes. **~1 day.**

### H-5  Update script assumes clean tree, no rollback

`scripts/Update-Raspberry.ps1` runs `git pull` — if the user has any local
edits (they might, for tweaking scripts) the update fails halfway. And if
the new build breaks, there's no way to revert to the last-known-good exe.
Fix:
- Detect `git status --porcelain`; if dirty, stash before pull and pop
  after.
- Before overwriting `target/release/raspberry-hub.exe`, copy it aside as
  `raspberry-hub.exe.bak`. On build failure, restore it and surface the
  error in the UI.
- Add a `raspberry --version --last-good` shortcut that swaps to `.bak`.
- **~3h.**

### H-6  No PowerShell 7 fallback / hard 5.1 coupling

`Update-Raspberry.ps1` is deliberately pure ASCII because "PowerShell 5.1
reads .ps1 in the system ANSI codepage." Windows 11 ships PowerShell 7.4
alongside 5.1 as `pwsh.exe`. Add a launcher that prefers `pwsh` when
present (UTF-8 by default, faster startup) and falls back to 5.1. This
unlocks unicode in progress messages and much better error output. **~1h.**

### H-7  No agent auto-start / Windows Service installer

Explicitly deferred to Phase 8 but ranked here because remote-agent value
is nearly zero if the user has to be logged in with a console window open.
Ship a `raspberry-agent --install-service` mode that registers a Windows
Service via `sc.exe` or the `windows-service` crate, running under
`NetworkService` (or a dedicated `raspberry-agent` account) with only the
privileges the endpoints actually need. **~1 day.**

### H-8  Zustand persistence stores tokens in localStorage

`apps/hub/src/state/useAgents.ts` uses `zustand/persist` with
`localStorage`, which writes cleartext JSON to
`%LOCALAPPDATA%\com.papaluke.raspberry\EBWebView\...`. Anyone with FS
access reads every registered agent's token. Two mitigations:
1. Use Tauri's `stronghold` plugin (encrypted at rest with a per-machine
   key) for the token field only; keep the rest of the RemoteAgent record
   in localStorage.
2. Or use the OS credential store via `keyring` crate on the Rust side and
   expose a `store_token` / `load_token` Tauri command.

The second is cleaner and reuses Windows Credential Manager. **~4h.**

---

## Medium Priority Improvements

### M-1  No result caching layer

Every UI refresh re-runs the underlying command. `winget list` takes 5–10s;
`security_snapshot` takes 1–3s. Add a small TTL cache in `crates/core`
(1s for stats, 30s for security, 60s for winget list) with an
`invalidate()` call surfaced through the Tauri command layer. Wraps
existing functions — no API break. **~1 day.**

### M-2  No metrics / observability

There's no way to answer "how long is a security scan taking on my rig?"
Add lightweight timing to every core function via a `tracing::instrument`
attribute, then expose a `/metrics` Prometheus endpoint on the agent
(behind auth). Grafana-ready. **~4h + optional dashboard work.**

### M-3  Frontend has no error boundary

If any module throws during render, the whole shell white-screens. Wrap
each panel in an `<ErrorBoundary>` that shows a "This module crashed —
[Report] [Reload]" card. **~2h.**

### M-4  Deep scan doesn't parallelize hostname resolution beyond the ping

`scan_lan_deep` in `crates/core/src/net.rs` uses `ping -a` to piggyback
DNS resolution on the ping — clever, but bounded to whatever Windows'
resolver does. Add optional NetBIOS name lookup (`nbtstat -A <ip>`) and
mDNS/SSDP discovery to catch printers, Apple devices, and IoT. Same
concurrency pattern. **~1 day.**

### M-5  No settings panel

The Hub has no user-facing settings. Theme (currently hardcoded dark),
polling intervals, deep-scan concurrency, cache TTLs, per-module
show/hide, keyboard shortcut customization — none of it is configurable.
Add a `Settings` module with a JSON config persisted to
`%APPDATA%\Raspberry\hub.toml`. **~1 day.**

### M-6  Command Palette matcher is substring-only

`apps/hub/src/command/matchCommands.ts` — inspect and upgrade to a
fuzzy-match with score weighting (fzf-style). Fuse.js is 20KB gzipped and
massively better UX. **~2h.**

### M-7  No dev container / reproducible build

`README.md` says "~10 minutes, mostly waiting for the first Rust build."
Give contributors a `.devcontainer/` or at least a `justfile` /
`taskfile.yml` that captures the exact toolchain (`rust-toolchain.toml`
is missing). Right now every dev picks up whatever Rust is on their
system. **~2h.**

### M-8  No signed releases

`target/release/raspberry-hub.exe` is unsigned. Windows SmartScreen shows
the yellow warning; Chrome deletes downloaded copies. Buy or use
Sigstore's `cosign` for keyless signing, and add a GitHub Actions
release workflow that signs the artifact. **~half day + cert cost.**

---

## Low Priority Improvements

### L-1  README hero image is 404-safe but hardcoded

`<img src=".github/assets/hero-demo.webp">` — that file exists, but the
README also links `docs/PHASE-7.md` which is fine. Consider a
`docs/screenshots/` directory that CI verifies has all referenced files.

### L-2  Cargo.toml doesn't pin dependency versions tightly

`sysinfo = "0.33"` accepts any 0.33.x. For a system-info library that
occasionally breaks its API between minor versions, consider `sysinfo =
"=0.33.1"` in a `Cargo.lock`-committed workspace (which you already do —
just noting the pattern).

### L-3  No changelog

`git log --oneline` is a proxy but a real `CHANGELOG.md` (Keep-a-Changelog
format, one section per Phase) would help users decide when to update.

### L-4  Docs use `raspberry/` but repo is capitalized `Raspberry/`

Windows is case-insensitive so it works, but on WSL / macOS / Linux this
matters. Grep the docs for path examples and normalize.

### L-5  No `SECURITY.md` / `CODE_OF_CONDUCT.md` / `CONTRIBUTING.md`

Standard OSS hygiene. Add short versions — issue templates too
(`.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`).

### L-6  No telemetry opt-in (which is fine — but say so)

A one-line "Raspberry sends no telemetry, ever" in the README + SECURITY
doc is a differentiator against the competition.

---

## Architecture Recommendations

### AR-1  Formalize the plugin/module system

The manifest + `ModuleRegistry` is already 80% of a plugin architecture.
Extract the last 20%:

- Define a stable `ModuleManifest` schema and version it
  (`schema_version: 1`).
- Split modules out of the monorepo into their own npm packages under
  `@raspberry/*` scope.
- Add a plugin loader that reads `%APPDATA%\Raspberry\plugins\*.zip`,
  verifies a signature (Ed25519), extracts, dynamically imports.
- Publish a `create-raspberry-module` scaffolding CLI.
- Reference: **Backstage.io**'s plugin system, **Grafana**'s panel
  plugins, **Obsidian**'s community plugin registry — all use a signed
  manifest + capability declaration model.

### AR-2  Add an API layer between core and consumers

Right now `raspberry-core` is called directly by both the Hub (via Tauri
commands) and the Agent (via Axum handlers). Both re-declare the same
routing. Extract an `ApiRouter` trait in `core` that both hosts implement
once; every new endpoint gets added in one place.

This is also the right time to introduce **OpenAPI generation**
(`utoipa` crate) so the frontend `Target` interface generates from the
Rust source instead of being hand-mirrored in `apps/hub/src/target/types.ts`.
The current situation is fragile: add a field in `SystemSnapshot` in Rust
and forget the TS mirror and the RemoteTarget silently drops it.

### AR-3  Move from `spawn_blocking` to a proper worker pool

The agent uses `tokio::task::spawn_blocking` which shares Tokio's
blocking pool (default 512 threads — huge). For agent workloads
(mostly PowerShell shell-outs, capped at 1 concurrent per unique command)
introduce a per-command semaphore so a burst of `/security_status` calls
doesn't spawn 5 concurrent PowerShell processes. Reuse the semaphore for
the `scan_lan_deep` concurrency cap already in `net.rs`.

### AR-4  Terminal UX improvements

`terminal.rs` (132 LOC) wraps `portable-pty` + xterm.js. Bring parity
with modern terminals:
- Split panes (horizontal + vertical), tab groups.
- Command palette integration: run `winget upgrade all` from `Ctrl+K`,
  results appear in a new pane.
- Terminal-driven actions: any `raspberry` CLI command mirrors to a
  panel refresh (e.g., `raspberry scan --deep` refreshes LAN Manager).
- SSH profile with per-agent bookmarks — you already have the agent list,
  give each agent an "Open SSH" tile that spawns a persistent PTY.

### AR-5  Async architecture: cross-module bus

`README` mentions the "cross-module bus" as Phase 5 — inspect its
current shape and consider migrating it to a proper Zustand-slice pattern
or a Redux Toolkit RTK-Query-style cache that dedupes subscriptions
across panels. Right now every panel likely polls independently.

### AR-6  Configuration system

There is no single source of user config today. Introduce:
- `%APPDATA%\Raspberry\hub.toml` — user prefs (polling, theme, plugin
  allow-list, panel visibility).
- `%APPDATA%\Raspberry\agent.toml` — already exists; extend for cert
  paths, allowlisted paths, per-command permissions.
- A `RaspberryConfig` Rust type shared between Hub and Agent; both parse
  it via `serde` + `toml`.
- On Hub side, surface via a Settings module (M-5).

### AR-7  Package management: switch to `pnpm`

The npm workspace already exists; migrating to `pnpm` cuts install time
in half and gives a much saner `node_modules` layout (content-addressed
store). Also gives per-workspace exact-version locking with
`pnpm-lock.yaml`.

### AR-8  Update mechanism: signed OTA

Today's updater is `git pull` + rebuild. Two failure modes: git remote
unreachable, or Rust build fails on the user's machine (a broken Rust
toolchain becomes the user's problem). Move to:
- GitHub Releases with signed `.msi` / `.exe` artifacts (tied to L-1
  above).
- Updater checks `/latest.json` on `github.com/LowLuke99/raspberry`, verifies
  the signature, downloads the artifact, installs.
- Reference: **Tauri Updater plugin** does this out of the box — you
  literally just configure a public key and enable it.

### AR-9  Cross-platform: macOS + Linux

The `raspberry-agent` is Windows-only in practice; `packages.rs` stubs
non-Windows. To make Raspberry a real cross-LAN tool:
- Feature-gate `security.rs` per OS (Defender/Firewall/BitLocker →
  `sudo scutil` on macOS, `firewalld`/`ufw` + `luksdump` on Linux).
- `packages.rs`: winget → `brew list --formula --json` on macOS, `apt
  list --installed` / `dnf list installed` on Linux.
- `network_scan_deep`: `arp -a` works on all three; make ping wrapper
  cross-platform (`net.rs` already conditionalizes `CREATE_NO_WINDOW`).
- Terminal already uses `portable-pty` which is cross-platform — good.
- Test matrix in CI: `windows-latest`, `macos-latest`, `ubuntu-latest`.

### AR-10  Remote access architecture: reverse-tunnel option

Once mTLS is in, add an optional "connect through Hub" mode where an
agent at a friend's house opens a persistent outbound WebSocket to a
central relay (self-hosted, e.g., via `frp` or a purpose-built Rust
relay), and the Hub connects to that. Then you have Raspberry on your
parents' PC without opening ports on their router. Reference:
**Tailscale** for the mental model, **rathole** or **frp** for the
transport.

### AR-11  Security hardening checklist (post-C1)

Once TLS + mTLS ships:
- Rate-limit `/health` and any auth-attempt endpoint (Axum's `tower-http`
  `RateLimitLayer`).
- Add `X-Raspberry-Agent-Version` header so the Hub can warn on version
  skew.
- Log every mutation (process kill, WoL, package install) to
  `%APPDATA%\Raspberry\audit.log` with actor + target.
- Add a `--read-only` startup flag that hard-disables every mutating
  endpoint regardless of allowlist config — Chekhov's gun for
  compromised-Hub scenarios.

### AR-12  Networking improvements (Watchtower Deluxe)

Watchtower is a per-process TCP connection table. Grow it into a
mini-Portmaster:
- Per-connection geolocation (offline MaxMind DB shipped with the app or
  fetched daily).
- ASN + reverse-DNS enrichment.
- Traffic-volume rollups (which process talked to which host, how much,
  when).
- Simple rules: "warn me if `notepad.exe` ever connects to anything."
- Requires eBPF / ETW hooks on Windows — that's a real engineering
  project. `windivert` or Windows Filtering Platform bindings via
  `windows-rs` are the path.

### AR-13  Automation capabilities

Add a `Playbooks` module: YAML files describing a sequence of Raspberry
actions with conditions. Example:
```yaml
name: "Every hour, check for winget upgrades and log them"
on: cron("0 * * * *")
steps:
  - packages_list_upgradable
  - if: upgradable.length > 0
    log: "{{upgradable.length}} upgrades available"
```
Ships with a small set of built-in playbooks (nightly deep scan, weekly
security snapshot diff, log rotation). Reference: **n8n**, **Home
Assistant** automations, **Cronicle**.

---

## Competitive Research Findings

**Cockpit** (Red Hat, github.com/cockpit-project/cockpit) — web-based Linux
server admin. Multi-host, modular (each panel is a separate GitHub repo
implementing a defined manifest), integrated terminal, systemd + storage +
network + packages. Very direct analogue for Raspberry's roadmap.
Learnings:
- Their manifest system is what Raspberry's `ModuleManifest` should grow
  into. Cockpit modules can declare required capabilities and API
  versions — copy this exactly.
- Cross-host management: Cockpit's "Add machine" flow uses SSH under the
  hood. Raspberry's HTTP agent is faster to set up but Cockpit's is
  zero-install on any Linux with SSH. Consider optionally supporting SSH
  as a transport for machines without the agent binary.
- Their Web Console is authoritative; local Tauri isn't needed. Raspberry
  could add a Cockpit-style web mode by mounting the built React `dist/`
  behind the same TLS layer as the agent.

**Portainer** (github.com/portainer/portainer) — container-focused, but the
agent architecture is exactly Raspberry's model: a central UI + edge agents
with mTLS + bearer tokens + explicit capability grants per agent.
Learnings:
- Their "Edge Agent" flow uses tunnels for machines behind NAT — feeds
  directly into AR-10.
- Their "Environment access" panel — a user can be granted read-only,
  read-write, or admin per environment. Raspberry has no user model yet,
  but when it does, this is the pattern.

**Meshcentral** (github.com/Ylianst/MeshCentral) — cross-platform mesh
agent for remote monitoring. Ships an agent for Windows / macOS / Linux
that phones home over WebSocket. Handles remote desktop, terminal, file
transfer.
Learnings:
- Their agent is a single executable that self-updates from the mothership
  — direct competitor to AR-8's OTA idea.
- Their web UI is 100% self-hosted and open-source — proof that a
  browser-based Hub works for this exact use case.

**NetAlertX** (formerly Pi.Alert, github.com/jokob-sk/NetAlertX) —
LAN presence monitoring. Historical device tracking, unknown-device
alerts, MAC-vendor DB, presence graphs.
Learnings:
- Presence timeline (which devices were up when) — massive value-add for
  LAN Manager. Feeds directly into Feature #1 below.
- Their MAC vendor DB (`oui.txt` from IEEE) is >1MB and updated monthly.
  Raspberry's tiny built-in OUI table needs to become a bundled + updatable
  DB.

**Tabby** (github.com/Eugeny/tabby) — modern cross-platform terminal.
Learnings:
- Their plugin system is dead-simple: drop a JS file in a folder, it
  self-registers. Model for AR-1's zero-signature dev plugin loop
  (production keeps signing).
- Their SSH profile UI (nested folders of connections with
  colors/icons/tags) is the reference for AR-4's SSH bookmarks.

**Wave Terminal** (github.com/wavetermdev/waveterm) — terminal with
widgets, tabs, integrated file browser and web preview.
Learnings:
- The "everything is a widget in a pane" layout is a compelling
  alternative to Raspberry's fixed sidebar-then-panel model. Consider a
  future "Workspace" mode where users compose their own dashboard from
  multiple modules at once.

**Angry IP Scanner** (github.com/angryip/ipscan) — the classic LAN
scanner. Java-based, 20+ years old, still shipping.
Learnings:
- Fetchers architecture: each column in the results is a plug-in fetcher
  (ping, hostname, MAC, HTTP title, NetBIOS name, custom TCP port).
  Direct model for extending Raspberry's LAN Manager into per-device
  enrichment plugins.

**Angry Oxide / RustScan** (github.com/RustScan/RustScan) — fast port
scanner in Rust. Wraps `nmap` at the end but the front-half is a very
fast async scanner.
Learnings:
- Ulimit-aware batching (`ulimit -n` on Unix, roughly equivalent
  file-handle cap on Windows). Directly applicable to `scan_lan_deep` at
  scale.

**Warp** (warp.dev, closed-source but well-documented UX) — modern
terminal with AI command generation, block-based history.
Learnings:
- "Block" model — each command + output is a first-class thing (copy,
  share, rerun). Raspberry's terminal is a stream today; blocks are worth
  copying.
- AI palette that translates NL to shell commands — feeds Feature #3
  below.

**Home Assistant** (github.com/home-assistant/core) — the automation and
integrations model is the closest to what a "Raspberry Playbooks" (AR-13)
should feel like.

**Portmaster** (github.com/safing/portmaster) — per-app firewall + DNS.
Learnings:
- Their process → connection → destination waterfall UI is beautiful
  and would slot directly into Watchtower. Their code is Go + Electron;
  the UI patterns port cleanly to React.

**Nushell** (github.com/nushell/nushell) — structured-data shell.
Learnings:
- Their `to json` / `from json` piping is what Raspberry's terminal
  could offer via a `raspberry` CLI: `raspberry ps | where cpu > 5 |
  raspberry kill` from the terminal itself.

---

## Feature Brainstorm #1 — LAN Timeline & Unknown-Device Alerts

### What it does

Passive, always-on tracking of every device that appears on the local
subnet. LAN Manager grows a "History" tab that shows a Gantt-style
timeline of when each MAC address was online, alerts on the first sight
of any MAC not in a known-good list, and lets you tag devices
(`kids-ipad`, `printer`, `guest-laptop`) so the timeline reads in plain
English.

### Why it fits this project

LAN Manager already does deep discovery (arp + reverse-DNS + latency).
The only missing piece is persistence and diffing. It slots directly into
the Raspberry design ethos: read-only, no cloud, "what's on my LAN and
what's it doing." A user opens the Hub, sees a red dot on LAN Manager,
clicks: "New device `bc:24:11:xx:xx:xx` (TP-Link) joined 3 hours ago,
still online." That is the killer daily-use moment Raspberry currently
doesn't have.

### Comparable projects

- **NetAlertX** (jokob-sk/NetAlertX) — the canonical implementation. Runs
  as a container, hits ARP on a schedule, stores in SQLite, notifies via
  Pushover / Telegram / email.
- **Fingbox** (proprietary) — same idea in appliance form.
- **Pi.Alert** — NetAlertX's predecessor.
- **arpwatch** — the OG BSD tool, from 1991.

### Initial research summary

NetAlertX's approach is: cron the scanner every N minutes, upsert every
seen `(mac, ip)` into a SQLite `Devices` table with `first_seen` /
`last_seen`, diff against last snapshot for "new" and "gone" events, fire
notifiers. UI is a device list with an "Alert on this?" toggle per row.
Their MAC vendor lookup uses the full IEEE OUI file (bundled + monthly
update job). Storage grows linearly (~1KB/device/day of presence data
compressed).

Raspberry has 90% of the input side already (`scan_lan_deep` returns MAC
+ IP + vendor + hostname + latency). The missing 10%:
- Persistent storage (`%APPDATA%\Raspberry\lan-history.sqlite`, via
  `rusqlite`).
- A background task in the Hub (Tauri `AsyncRuntime::spawn` on startup)
  that runs deep scan every 5 min and writes to the DB.
- A "History" tab in LAN Manager using `recharts` / `visx` for the
  timeline (Framer Motion is already installed for the animation).
- A "Known devices" allowlist stored in `%APPDATA%\Raspberry\devices.toml`.
- Simple in-app notifier — a top-bar bell that ticks up when a new MAC
  appears; click for the history view.

### Suggested MVP

1. `raspberry-core` adds `lan_history` module: SQLite via `rusqlite`,
   schema `devices(mac PK, first_seen, last_seen, tag, alert_on)` +
   `sightings(mac, seen_at, ip, hostname, rtt_ms)`.
2. Hub adds a `LanHistoryScheduler` background task that calls
   `scan_lan_deep` every 5 minutes and upserts. Skip if the last scan
   returned <2s ago (avoid duplicate scans if the user is on the panel).
3. New tab in `LanManager` module — table view of devices, "Alert on
   new" toggle, "Tag" free-text field.
4. Top-bar bell increments on new-device event; badge shows count.
5. Persist through updates (SQLite lives in `%APPDATA%`, not in the
   repo).

### Implementation outline

- `crates/core/src/lan_history.rs` (new) — SQLite CRUD.
- `crates/core/Cargo.toml` — add `rusqlite = { version = "0.32", features = ["bundled"] }`.
- `apps/hub/src-tauri/src/lib.rs` — new commands
  `lan_history_devices`, `lan_history_sightings(mac, since)`,
  `lan_history_tag(mac, tag)`, `lan_history_alert(mac, on)`.
- `apps/hub/src-tauri/src/scheduler.rs` (new) — periodic task.
- `apps/hub/src/modules/lan-manager/HistoryTab.tsx` (new).
- `apps/hub/src/modules/lan-manager/DeviceTagInput.tsx` (new).
- `apps/hub/src/layout/TopBar.tsx` — add bell + badge.

### Difficulty · Estimated Time

**Medium.** ~3–5 days of focused work. SQLite integration is straightforward
in Rust, the UI is a table + a chart, and the scheduler is a `tokio::spawn`
with a `tokio::time::interval`.

---

## Feature Brainstorm #2 — Raspberry Plugin Marketplace (`raspberry.dev/plugins`)

### What it does

Extends the existing `ModuleRegistry` into a full plugin system: modules
can be developed outside the monorepo, packaged as signed `.rzp` files,
installed from a curated online registry, and hot-loaded by the Hub. A
new "Plugins" module lists installed + available modules, shows publisher
identity (Ed25519 pubkey), permissions requested (`network`, `filesystem`,
`processes:kill`), and one-click enable/disable.

### Why it fits this project

The `ModuleManifest` + `ModuleRegistry` + `registerAll()` pattern already
exists in `apps/hub/src/modules/registry.ts`. Every current module could
be re-shipped as a plugin without changing its component code. This
turns Raspberry from "one app with 17 modules" into "an app platform with
17 built-ins and an ecosystem." That is a 10× value proposition — third
parties get a distribution channel, users get modules the core team never
would have prioritized (weird hardware, niche shells, custom OSINT
sources).

### Comparable projects

- **Backstage.io** (Spotify) — plugin marketplace for developer portals.
  Their manifest + capability model is the gold standard.
- **Obsidian** — plugin registry with community-run curation. Ed25519
  signing, per-plugin permissions.
- **Grafana** — signed plugins, plugin catalog, versioned API.
- **Tabby** — terminal plugin system, drops JS files with hot-reload.
- **VS Code** — the classic. Publisher identity, sandboxed extension
  host, granular activation events.
- **Home Assistant** — HACS (Home Assistant Community Store) is a
  community-run alternative registry that HA officially tolerates —
  useful model for a "trust root" split (official vs. community).

### Initial research summary

Two hard problems: distribution and trust. Backstage solves distribution
via npm — plugins are just npm packages under `@backstage/plugin-*`, and
Backstage's CLI wires them in. Obsidian solves it via a GitHub-hosted
JSON manifest (`community-plugins.json`) that lists (id, repo, description);
the app downloads directly from GitHub releases.

For trust: Obsidian ships every plugin's release binary from the user's
own machine's GitHub connection, and the community manifest is curated
by hand by the Obsidian team (~200 PRs/week). Grafana signs plugins with
their private key and pins the pubkey in-app. VS Code combines both —
publisher identity + Microsoft's signature over the marketplace metadata.

For Raspberry the simplest v1 is Obsidian's model: a GitHub-hosted
JSON manifest, plugins are `.rzp` zip files attached to GitHub releases,
Ed25519 signature verified against a pubkey embedded in the manifest.
Curation is 1 person (you) reading each PR. When traffic grows, add a
`community/` split like HACS.

### Suggested MVP

1. Define `.rzp` = zip file containing:
   - `manifest.json` — id, version, name, description, capabilities,
     entry point, publisher pubkey.
   - `dist/` — pre-built JS bundle.
   - `signature.bin` — Ed25519 signature over `manifest.json` + hash of
     `dist/`.
2. `raspberry-core` adds a plugin loader (Rust side unzips + verifies,
   TS side dynamically imports the entry).
3. New `Plugins` module — table of installed plugins, "Browse" button
   opens the community registry (fetched from a URL configured in
   settings).
4. First-run flow: user drops a `.rzp` into a folder or clicks "Install
   from URL." Hub restarts to load new modules (plugin hot-reload is a
   v2 problem).
5. Ship the `create-raspberry-plugin` scaffolding CLI on npm.

### Implementation outline

- `crates/core/src/plugins.rs` (new) — unzip, sig verify (via
  `ed25519-dalek`), manifest parse.
- `apps/hub/src-tauri/src/lib.rs` — new commands
  `plugins_install(path)`, `plugins_list()`, `plugins_enable(id)`,
  `plugins_uninstall(id)`, `plugins_available()`.
- `apps/hub/src/modules/plugins/PluginsPanel.tsx` (new).
- Dynamic loader at startup — `import()` each enabled plugin's entry.
- New repo: `raspberry-plugins-community` — hosts `community.json`
  manifest.
- `create-raspberry-plugin` published to npm.

### Difficulty · Estimated Time

**Hard.** ~2–3 weeks. Signing / verification is straightforward with
`ed25519-dalek`, but the surface area (plugin lifecycle, hot-reload
UX, community moderation policy, the CLI scaffolder, docs for plugin
authors) adds up. Recommended: ship MVP as sideload-only (paste URL)
first; add the community registry once you have 2–3 plugins to seed it.

---

## Feature Brainstorm #3 — Ctrl+K AI Copilot (`ask a question, get an action`)

### What it does

The command palette (already `Ctrl+K`) grows a natural-language mode. Type
in plain English — "which process is eating my CPU right now?", "wake my
NAS", "install VLC", "show me who's on the LAN" — and Raspberry produces
one of three things: the direct answer with data pulled from the right
module, a proposed action ("Wake `bc:24:11:...`?") with an explicit
confirm, or a step-by-step recipe if it needs multiple modules. Runs on
a local LLM by default (Ollama), optionally against Claude / GPT with a
user-provided key.

### Why it fits this project

`ModuleManifest` gives the LLM a discoverable action surface — every
module already describes what it does. The palette already has
match/rank/execute plumbing. Every Tauri command is documented and
typed. The bridge from "user says something" to "call the right command
with the right args" is almost mechanical given the existing structure.

Also, Raspberry's current UX has a real friction point: 17 modules is a
lot to remember. "Where's the port checker?" is a real question the AI
can answer without the user hunting through the sidebar.

### Comparable projects

- **Warp** (warp.dev) — AI command generation from NL prompts. Their UI
  pattern (block the terminal on suggestion, user hits Enter to run) is
  the model.
- **Fig / Amazon CodeWhisperer for CLI** — inline completions in the
  terminal.
- **Raycast** (macOS) — command palette + AI extensions marketplace.
- **Warp AI**, **GitHub Copilot in the CLI** (`gh copilot`) — NL → shell.
- **LM Studio** / **Ollama** for the local-first inference story.
- **LangChain** / **CrewAI** for the agent tool-calling patterns, though
  Raspberry is small enough not to need a framework.

### Initial research summary

Local inference is table stakes now — a 4B / 8B model on Ollama runs at
~20 tok/sec on a 5700G with GPU offload, ~5 tok/sec on CPU. Latency for
"parse a 40-word question, emit a JSON tool call" is under 3 seconds,
which is acceptable for a palette. Tool-calling with structured output
works reliably on:
- **Llama 3.1 8B** — best local option today.
- **Qwen 2.5 7B / 14B** — very good structured output.
- **Phi 3.5 Mini** — smallest usable, ~2.7 tok/sec on CPU.

The pattern that works: give the LLM a JSON schema of available "tools"
(module actions with their args), have it emit a single tool call, the
app validates the schema, presents the call to the user with a
one-sentence explanation, executes on confirm.

For safety in a system-management tool: the LLM never executes
directly. It always proposes; user confirms. Destructive tools
(`process_kill`, `packages_install`, `wake_on_lan`) require a second
Enter. Read-only tools (`system_snapshot`, `scan_lan`, `logs_read`)
auto-execute but their output is displayed inline in the palette so the
user sees the answer without leaving the current module.

### Suggested MVP

1. Palette gains a special prefix — `Ctrl+K` then `?` enters ask mode.
2. Local Ollama detected at `http://localhost:11434`. If missing, palette
   shows "Install Ollama and pull a model" with a one-click winget install.
3. Build the tool schema from `ModuleRegistry`: each module registers a
   short natural-language description + a list of actions with
   `(name, description, args_schema)`.
4. First request: `POST http://localhost:11434/api/chat` with the schema
   in the system prompt, the user's question in the user prompt, request
   JSON output.
5. Parse response. If it's a read-only action, execute + display inline.
   If it's a mutation, show the proposed call in a big banner with
   Confirm / Reject.
6. Log every AI-driven action to `%APPDATA%\Raspberry\ai-audit.log`.

### Implementation outline

- `crates/core/src/ai.rs` (new) — Ollama HTTP client + tool-call
  serialization.
- `apps/hub/src-tauri/src/lib.rs` — new commands `ai_available()`,
  `ai_ask(question)`, `ai_execute(call_id)`.
- `apps/hub/src/command/AskMode.tsx` (new) — palette overlay.
- `apps/hub/src/modules/*/manifest.tsx` — extend each existing manifest
  with `aiDescription` + `aiActions`.
- Settings module (M-5) gets an "AI" tab — model selection, Claude/OpenAI
  key entry, audit log viewer.

### Difficulty · Estimated Time

**Medium–Hard.** ~1.5–2 weeks. The Ollama wiring is trivial (~1 day).
The interesting work is:
- Tool schema design — how much detail does each module expose without
  bloating the prompt? (Iterate on real questions.)
- Confirmation UX for destructive actions — has to feel safe without
  being annoying.
- Multi-step recipes ("install VLC then open it") — plan/step
  execution, retry on failure, one-turn LLM vs. multi-turn agent. Start
  single-step, evolve to multi.

---

## Suggested Development Timeline

Phase → estimated calendar time assuming solo, 1–2 hours/day.

| Phase | Scope | Weeks |
|-------|-------|-------|
| **8** (already planned) | TLS + mTLS + Windows Service (C-1, H-7) | 1–2 |
| **8.1** (hardening pass) | CSP (C-3), test baseline (C-2), spawn_blocking cleanup (C-4), poisoned-mutex fix (C-5), file allowlist (H-2) | 2 |
| **8.2** (updater & polish) | Signed OTA (AR-8), rollback (H-5), keyring for tokens (H-8), settings module (M-5) | 2 |
| **9** (LAN Timeline) | Feature Brainstorm #1 | 1–2 |
| **9.1** (Watchtower Deluxe) | AR-12: geolocation, ASN, per-process rules | 2 |
| **10** (Plugin marketplace v1) | Feature Brainstorm #2 sideload MVP | 2 |
| **10.1** (community registry) | GitHub-hosted plugin index + curation process | 1 |
| **11** (AI palette) | Feature Brainstorm #3 | 2 |
| **12** (cross-platform) | AR-9: macOS + Linux agent, feature-gated modules | 3–4 |

Total to Phase 12: **~5–6 months** at 1–2 hours/day.

---

## Next Sprint (Actionable Tasks)

Ordered by dependency + risk. Each item is small, done in one sitting,
and pushes to `main`.

1. **Add CI.** Create `.github/workflows/ci.yml` — `cargo fmt --check`,
   `cargo clippy -- -D warnings`, `cargo build` on `windows-latest`, `npm
   ci && npm run build`. **~1h.**
2. **Set a strict CSP** in `tauri.conf.json` (C-3). Test that every
   panel still renders. **~2h.**
3. **Wrap all blocking Tauri commands in `spawn_blocking`** (C-4).
   Grep `lib.rs` for `fn` handlers that don't have it. **~3h.**
4. **Fix poisoned-mutex crashes** — replace `.expect("monitor mutex
   poisoned")` with `.unwrap_or_else(|e| e.into_inner())` (C-5).
   **~1h.**
5. **Add first tests:** unit test the winget parser with 3–4 recorded
   outputs, unit test `ct_eq`, integration test `/health` + `/snapshot`
   auth on the agent. **~4h.**
6. **Tighten agent CORS** — replace `CorsLayer::permissive()` with an
   explicit whitelist (or drop CORS; Tauri isn't a browser origin). **~30m.**
7. **Add a `SECURITY.md`** with the current threat model (LAN-local,
   trusted network) and Phase 8's plan. **~30m.**
8. **Path allowlist on `/files_list`** (H-2) — canonicalize + prefix
   check against a configured list. **~2h.**
9. **Update-script rollback** (H-5) — copy `.exe` aside before
   overwrite. **~2h.**
10. **CHANGELOG.md** (L-3) — write from `git log --oneline`, one
    section per Phase. **~1h.**

Total: about **17 hours** — one solid weekend or two evenings a week for
two weeks. When it's done, every subsequent phase ships onto a much
firmer foundation.

---

*This document is meant to be revised as items land. When you complete a
Critical or High item, replace its section with a one-line note pointing
at the commit that fixed it, and move it into a "Resolved" section at
the bottom.*

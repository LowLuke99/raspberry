# Changelog

All notable changes to Raspberry are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions loosely
follow [SemVer](https://semver.org/) — we cut a minor bump per Phase, patch
bumps for fixes.

## [Unreleased]

### Added
- `docs/project-audit/README.md` — deep audit + roadmap, 3 feature
  brainstorms, and a 10-item Next Sprint punch-list.
- `.github/workflows/ci.yml` — fmt, clippy (`-D warnings`), test, and build
  on every push and PR to `main`.
- `SECURITY.md` — documented threat model, current gaps, and how to
  report vulnerabilities.
- `CHANGELOG.md` — this file.
- Path allowlist for the remote-agent `/files_list` endpoint
  (`apps/agent/src/paths.rs`). Requests outside the user home or a drive
  root get `403 Forbidden` even for a paired Hub.
- Baseline unit tests: winget-parser column-shape tests
  (`crates/core/src/packages.rs`), constant-time-compare tests
  (`apps/agent/src/main.rs`), random-token entropy tests
  (`apps/agent/src/config.rs`), path allowlist tests
  (`apps/agent/src/paths.rs`).

### Changed
- **Strict CSP** on the Tauri window (`apps/hub/src-tauri/tauri.conf.json`):
  `default-src 'self'`, script-src `'self'` only, `object-src 'none'`,
  `frame-ancestors 'none'`. Replaces the previous `"csp": null`.
- **All OS-touching Tauri handlers now use `spawn_blocking`**
  (`apps/hub/src-tauri/src/lib.rs`): security_status, network_info,
  network_scan, storage_disks, files_list, files_roots, logs_read,
  process_kill, process_list, system_snapshot. PowerShell / `arp` /
  `sysinfo` calls no longer stall the async command worker.
- **Poisoned-mutex safe locks**: `unwrap_or_else(|e| e.into_inner())` in
  place of `.expect(...)`. A single `sysinfo` panic can no longer brick
  every subsequent Tauri call.
- **CORS on the agent** scoped from `permissive()` to explicit `allow_any`
  origin + explicit method/header allowlist
  (`apps/agent/src/main.rs`).
- **Updater rollback**: `scripts/Update-Raspberry.ps1` now copies
  `raspberry-hub.exe` to `.bak` before rebuild and restores it on build
  failure — a broken update no longer leaves the user with no working
  exe.

### Fixed
- Two `clippy` warnings on `raspberry-core`
  (`unnecessary_sort_by`, `for_kv_map`) — required for CI's `-D warnings`
  gate.

## [0.7.1] — Phase 7.2

### Added
- **Personas** — synthetic identity generator with configurable field
  set. `feat(personas): synthetic identity generator + Phase 7.2 sparklines`.
- **Command Deck sparklines** — per-agent CPU / RAM history rendered as
  inline sparklines on the deck tiles.

## [0.7.0] — Phase 7 & Phase 7.1

### Added
- **Command Deck** — Watchtower quick-jump tile
  (`feat(deck): add Watchtower quick-jump tile`).
- **Watchtower** — live per-process TCP connection radar. PowerShell
  `Get-NetTCPConnection` + `Get-Process` bridged into a live table with
  hostname enrichment.
- **Command Deck section-hero tiles** — cinematic module tiles as the
  home screen.
- **Brand system** — full Kling-generated visual identity
  (`feat(brand): full Kling-generated visual identity`).
- **Phase 7.1 Toolbox rebuild** — Dev Toolbox replaced with practical
  LAN-adjacent utilities (Port Check, Password Generator, WiFi QR,
  URL/Text QR, UUID, Timestamp). Backed by a new Rust `tcp_port_check`
  in `raspberry-core`.
- **Ctrl+K palette machine switch** — `Switch to: <machine>` entries in
  the palette for every registered agent.
- **Phase 7 Packages** — full `winget` frontend: search catalog, list
  installed, list upgradable, upgrade all, uninstall individual packages.
  Read-only on remote agents.
- **Sysinfo Card** — `fastfetch` JSON rendered as an identity card. Shows
  a `winget install --id Fastfetch-cli.Fastfetch -e` hint if the binary
  is missing.
- **Live agent health chip** — 5s `/health` probe against every
  registered agent, dot color-coded green (≤1.2s RTT) / amber / red.

## [0.6.0] — Phase 6

### Added
- **Remote agent (v0.1)** — new `apps/agent` Rust binary
  (`raspberry-agent`) exposing shared `core` over HTTP + bearer token.
  Machine picker in the top bar, persistent agent list, pairing flow
  with a live `/health` probe. Read-only in v0.1.

## [0.5.x] — Phase 5, 5.5, 5.6, 5.7, 5.8

### Added
- **Phase 5.8** — LAN deep scan (`/24` ping-sweep, hostname + RTT per
  device, expanded OUI table).
- **Phase 5.7** — one-click updater (`scripts/Update-Raspberry.ps1`),
  desktop shortcuts, silent VBS launcher.
- **Phase 5.6** — Tweaks (winutil), Identity (Holehe + Sherlock OSINT),
  LocalSend (v2 HTTP protocol client), Kernel Inspector (System Informer).
- **Phase 5.5** — Commands page redesign, Recent tab, `Ctrl+K` palette
  searches Windows commands too.
- **Phase 5** — Storage, Security, Logs, Command Deck + cross-module bus.

### Fixed
- Updater rewritten as pure ASCII so PowerShell 5.1 (which reads .ps1
  files in the system ANSI codepage) can parse it.
- Deep-scan console-window flood — every child process now uses
  `CREATE_NO_WINDOW`.
- Firewall / BitLocker enum ints translated to human labels; Defender
  script tidied.

## [0.4.0] — Phase 4

### Added
- Network Dashboard (interfaces, MAC, local IP, gateway).
- LAN Manager (ARP discovery, OUI lookup, Wake-on-LAN).
- Live status bar with per-tick metrics.

## [0.3.0] — Phase 3

### Added
- Real tabbed terminal (xterm.js + portable-pty). PowerShell / CMD / WSL
  behind a real PTY.

## [0.2.0] — Phase 2

### Added
- Shared Rust `crates/core` (sysinfo) exposed to the frontend through
  Tauri commands. System Monitor, Process Explorer, Graphs, and Files
  show real live data in the native app.
- `MockTarget` for the browser preview so the UI renders without a
  running Tauri host.

## [0.1.0] — Phase 1

### Added
- Matte-black glass UI + design tokens, top bar, collapsible sidebar
  rail, routed module panels, status bar, `Ctrl+K` palette.
- Tauri (React + Rust) app scaffold.
- npm + Cargo workspaces.

[Unreleased]: https://github.com/LowLuke99/raspberry/compare/v0.7.1...HEAD

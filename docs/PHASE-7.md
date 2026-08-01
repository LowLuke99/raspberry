# Phase 7 — Packages, Sysinfo Card, live agent health

Shipping notes for the modules added in this phase, plus the machine-chip
health-polling upgrade. See [MODULES.md](MODULES.md) for the user-facing
descriptions.

---

## Packages (winget frontend)

**Where:** `apps/hub/src/modules/packages/PackagesPanel.tsx` (UI),
`crates/core/src/packages.rs` (Rust), `apps/hub/src-tauri/src/lib.rs`
(Tauri commands `pkg_list` / `pkg_upgradable` / `pkg_search` / `pkg_install`
/ `pkg_uninstall` / `pkg_upgrade` / `pkg_upgrade_all`), `apps/agent/src/main.rs`
(HTTP endpoints under `/packages/*`).

**What it does:**
- Wraps the built-in `winget` binary. No external dependency to install —
  every up-to-date Windows 11 has winget preloaded.
- Three tabs: Installed / Upgradable / Search. Installed and Upgradable pull
  on tab open (cached after). Search runs on Enter.
- On the local Hub target: full install / uninstall / upgrade actions per
  row, plus an "Upgrade all" button that runs `winget upgrade --all`.
- On remote agents: read-only. Listing, upgradable, and search all work over
  the agent's `/packages/*` endpoints. Mutations are hidden until the mTLS +
  per-command allowlist gate lands in Phase 8. Rows show `read-only` in the
  action column.

**Parsing:** winget refuses to emit machine-readable JSON for `list` /
`search` (the `--output json` flag it advertises is import/export only). The
Rust side (`parse_table`) reads winget's fixed-column text output by
locating the `Name` / `Id` / `Version` / `Available` / `Source` column
starts from the header row and slicing each subsequent row accordingly.
Robust across locales because we key off the header text winget prints in
the invocation locale.

**Safety:** package ids passed to `install` / `uninstall` / `upgrade` are
validated against `[A-Za-z0-9._\-+]` — nothing else. This prevents flag
injection through a malformed id. Every winget call passes `--exact`,
`--silent`, `--accept-source-agreements`, `--accept-package-agreements`,
and `--disable-interactivity` so the spawned console never prompts (a
prompt would hang the request forever).

---

## Sysinfo Card (fastfetch)

**Where:** `apps/hub/src/modules/sysinfo-card/SysinfoCardPanel.tsx` (UI),
`crates/core/src/sysinfo_card.rs` (Rust), Tauri command `sysinfo_card_cmd`,
agent endpoint `/sysinfo_card`.

**GitHub source:** [fastfetch-cli/fastfetch](https://github.com/fastfetch-cli/fastfetch)
— a modern, actively maintained neofetch replacement written in C. Cross-
platform, fast, ships as a `winget` package.

**Install:**
```
winget install --id Fastfetch-cli.Fastfetch -e
```

The panel is intentionally graceful when fastfetch isn't on PATH: it shows
an install hint with **Copy** and **Run in Terminal** buttons (the second
one uses the shared bus to switch to the Terminal module and paste the
install line without pressing Enter).

**Data flow:** we invoke `fastfetch --pipe --format json` and walk the array
of `{type, result}` entries. `SysinfoCard.rows` is a flat, normalized
`{key, value}[]` — easy for React to render. `SysinfoCard.raw_json` keeps
the full payload for a "Raw" tab so users can see everything fastfetch
knows, including modules we don't parse yet.

**Card layout:** left column is a Raspberry-tinted badge (host + OS + a tiny
raspberry glyph). Right column is a striped key/value list. Toggle to Raw
for the full JSON with a Copy button.

---

## Live agent health polling

**Where:** `apps/hub/src/layout/MachineChip.tsx` — a new `useAgentHealth`
hook plus render changes.

**How it works:**
- One `setInterval` (5s) probes every registered agent's `/health`
  endpoint via the existing `probeAgent` helper. `/health` needs no auth,
  so it works before pairing too.
- RTT is measured with `performance.now()` around the probe. Anything above
  1200ms flips to the **slow** bucket even if it succeeded — a valid signal
  the agent is under load.
- The chip in the top bar takes on the color of the selected agent's
  status. Every row in the machine popover shows a small status dot in the
  bottom-right of its icon plus a monospace RTT tag on the right.
- One heartbeat regardless of agent count. Adding / removing an agent
  restarts the loop via the effect's dependency on `agents`.

**Color legend:**
| Status | RGB | Meaning |
|---|---|---|
| up | `52,211,153` | Reachable, RTT ≤ 1.2s |
| slow | `251,191,36` | Reachable but slow (> 1.2s) |
| offline | `248,113,113` | Probe failed / timed out |
| unknown | `148,163,184` | Never probed yet |

---

## Testing checklist

- [ ] `cargo check -p raspberry-core` — clean
- [ ] `cargo check -p raspberry-agent` — clean
- [ ] `cargo check -p raspberry-hub` — clean
- [ ] `npx tsc --noEmit` from `apps/hub` — clean
- [ ] Packages module: Installed tab populates; Upgradable shows any
  upgradable rows; Search returns catalog matches on Enter.
- [ ] Sysinfo Card renders rows when fastfetch is present; falls back to
  install hint when it isn't.
- [ ] Machine chip: register a fake agent (unreachable URL) — chip should
  go red within one interval; register a real agent and it should go
  green with an RTT tag.

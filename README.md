# Raspberry 🍇

> One glass panel, every machine on your LAN. Minimal surface, deep power.

<p>
  <a href="docs/SETUP.md"><b>🚀 Setup</b></a> ·
  <a href="docs/UPDATING.md"><b>🔄 Updating</b></a> ·
  <a href="docs/MODULES.md"><b>🧩 Modules</b></a> ·
  <a href="docs/TROUBLESHOOTING.md"><b>🩹 Troubleshooting</b></a>
</p>

Raspberry is a native Windows control panel for your PC and everything on
your LAN — process explorer, terminal, event logs, network scanner, wake-on-
LAN, curated command library, LAN file transfer, OSINT lookup, and more. All
in one matte-black glass UI, all read-only by default, no cloud.

---

## Quick start

**First time on this PC?** → [docs/SETUP.md](docs/SETUP.md) (~10 minutes,
mostly waiting for the first Rust build).

**Already set up?** → double-click **Raspberry** on your Desktop.

**Want the latest features?** → double-click **Update Raspberry** on your
Desktop.

That's the whole daily workflow. No terminal needed.

---

## What's inside

15 modules across four sections. Full list in
[docs/MODULES.md](docs/MODULES.md).

**Shell** — [Terminal](docs/MODULES.md#shell) · Commands · Tweaks · Identity
(OSINT) · LocalSend · Kernel Inspector

**System** — System Monitor · Process Explorer · Network · LAN Manager ·
Files · Storage · Security · Graphs · Logs · Dev Toolbox

**Deck** — the home screen: live tiles + jump grid

---

## Phase history

**Phase 1 — Shell & Design System** ✅ — matte-black glass UI, design tokens,
top bar, collapsible sidebar rail, routed module panels, status bar, `Ctrl+K`
palette.

**Phase 2 — Local Core** ✅ — shared Rust `crates/core` (sysinfo) exposed to
the frontend through Tauri commands. System Monitor, Process Explorer,
Graphs, and Files show real live data in the native app; the browser preview
uses `MockTarget`.

**Phase 3 — Terminal** ✅ — real tabbed terminal (xterm.js + portable-pty),
PowerShell / CMD / WSL behind a real PTY.

**Phase 4 — Network + discovery** ✅ — Network Dashboard (interfaces, MAC,
local IP, gateway) + LAN Manager (ARP discovery, OUI lookup, Wake-on-LAN) +
live status bar.

**Phase 5 — Power modules + release** ✅ — Commands, Storage, Security, Logs,
Command Deck, cross-module bus.

**Phase 5.5 — Palette & readability polish** ✅ — Commands page redesign,
Recent tab, Ctrl+K palette now searches Windows commands too.

**Phase 5.6 — GitHub power-ups** ✅ — four new modules pulling in proven
tooling:
- **Tweaks** — curated [ChrisTitusTech/winutil](https://github.com/ChrisTitusTech/winutil)
  commands
- **Identity** — [Holehe](https://github.com/megadose/holehe) +
  [Sherlock](https://github.com/sherlock-project/sherlock) OSINT
- **LocalSend** — real [LocalSend](https://github.com/localsend/localsend) v2
  HTTP protocol client
- **Kernel Inspector** — one-click actions backed by
  [System Informer](https://github.com/winsiderss/systeminformer)

**Phase 5.7 — Frictionless updates** ✅ — one-click updater
([`scripts/Update-Raspberry.ps1`](scripts/Update-Raspberry.ps1)) + desktop
shortcuts + docs so daily use never touches a terminal.

**Next: Phase 6** — Agent binary + mTLS transport (drive a second machine
remotely), plus a Rust-backed LocalSend server + Identity streamer that runs
Holehe/Sherlock in-process instead of shelling out.

---

## Rebuilding manually

If the shortcut is missing or broken:

```powershell
cd C:\Users\lukep\OneDrive\Documents\ClaudeProject\raspberry
git pull
npm install
npm run tauri:build
apps\hub\src-tauri\target\release\Raspberry.exe
```

Or re-create the shortcuts:

```powershell
.\Install-Raspberry.bat
```

Full docs: [Updating](docs/UPDATING.md) · [Troubleshooting](docs/TROUBLESHOOTING.md).

---

## Repo layout

```
raspberry/
├─ package.json            # npm workspace root
├─ Cargo.toml              # Rust workspace
├─ Install-Raspberry.bat   # double-click to place Desktop shortcuts
├─ scripts/
│  ├─ Update-Raspberry.ps1 # git pull + build + launch
│  ├─ Launch-Raspberry.ps1 # just launch the built exe
│  └─ Install-Shortcuts.ps1
├─ docs/
│  ├─ SETUP.md
│  ├─ UPDATING.md
│  ├─ MODULES.md
│  └─ TROUBLESHOOTING.md
├─ crates/core/            # Shared Rust: sysinfo, network, storage, security, logs
└─ apps/hub/               # Tauri app (React + Rust)
```

---

## Design rules honored

- **Motion:** GPU transforms/opacity only, 130ms ease-out on hover, spring on
  panel enter (Framer Motion).
- **Minimalist:** empty by default; detail blooms on hover/focus.
- **TypeScript strict** (plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`).
- **Fonts:** Inter (UI) + JetBrains Mono (numbers/metrics), bundled via
  `@fontsource` so the Tauri window works offline.

---

*Raspberry: one panel, every machine, all yours.*

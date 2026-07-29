# Raspberry 🍇

> One glass panel, every machine on your LAN. Minimal surface, deep power.

**Phase 1 — Shell & Design System** ✅ — matte-black glass UI, design tokens, top
bar, collapsible sidebar rail, routed module panels, status bar, `Ctrl+K` palette.

**Phase 2 — Local Core** ✅ — a shared Rust `crates/core` (sysinfo) exposed to the
frontend through Tauri commands (`LocalTarget`). **System Monitor, Process
Explorer, Graphs, and Files now show real, live data** from the local machine in
the native app. The browser preview (`npm run dev`) uses a `MockTarget` so it
still runs without Rust — each panel shows a **LIVE** (native) or **SAMPLE**
(browser) badge so you always know which you're looking at.

**Phase 3 — Terminal** ✅ — a real tabbed terminal (spec §9): xterm.js in the
frontend, a `portable-pty` backend that spawns PowerShell / CMD / WSL behind a
pseudo-terminal, streaming output over `term:data:<id>` events with keystrokes
and resize piped back. Sessions persist across tab switches. Native app only
(the browser preview shows a "native only" notice, since PTYs need the OS).

**Phase 4 — Network + discovery** ✅ — Network Dashboard (interfaces, MAC, local
IP, gateway via the `netdev` crate) and Local Network Manager (LAN device
discovery from the ARP cache, built-in OUI vendor lookup, and **Wake-on-LAN**
magic packets over UDP broadcast). Also wired the bottom **status bar to live
data** (was still mock through Phase 3).

**Phase 5 — Power modules + release** ✅ — the app is now genuinely useful:

- **Commands** — searchable Windows commands library (61 curated CMD /
  PowerShell one-liners across 8 categories). Click a card to copy it; hit the
  chevron to see a plain-English description of what it does; star to pin to
  favorites (persists via localStorage). In the native app each card also gets
  a **Run** button that switches to the built-in Terminal and pastes the
  command (does not auto-press Enter — the user still confirms).
- **Storage** — volume rings (used %, colored by remaining space) plus a real
  physical-disk table (SSD/HDD/NVMe/USB, model, capacity, health, serial)
  sourced from `Get-PhysicalDisk`.
- **Security** — a live posture score plus Windows Defender status (realtime,
  tamper protection, signature age, last scans), Firewall per profile,
  BitLocker per volume, UAC level, and the last 20 Windows updates. All
  read-only; nothing is ever mutated.
- **Logs** — Windows Event Log viewer (System / Application / Security) via
  `Get-WinEvent`, with level filter, full-text search, and per-row expand
  showing the full event body.
- **Command Deck** — the actual home screen now: hero card for the active
  machine, four live vital tiles (CPU / memory / net / processes), a volume
  strip, and a jump grid to every tool.
- **Cross-module bus** — a tiny typed EventTarget (`src/lib/bus.ts`) lets one
  module ask the shell to switch panels (`nav:go`) or the Terminal to paste a
  command (`terminal:run`) without either side knowing about the other.

**Phase 5.5 — Palette & readability polish** ✅ — quality-of-life pass over the
UX now that the modules are complete:

- **Commands page redesign** — cards breathe: the command name gets two full
  lines instead of ellipsis, the mono command sits on its own dedicated (and
  wrapping) copy strip, and the category filter is a horizontal scroll rail
  with edge-fade arrows instead of a wall of wrapping pills. A **Recent** tab
  tracks the last six commands you copied or ran (persisted via
  localStorage), so the tools you actually use surface first next session.
- **Ctrl+K meets Windows commands** — the command palette now searches the
  full commands catalog alongside module jumps. Typing anything queries both
  layers; **Enter on a command entry copies it to the clipboard** (palette
  stays open so you can copy another). Module jumps still Enter-and-close as
  before.

Next: Phase 6 — Agent binary + mTLS transport (drive a second machine remotely).

---

## Run it

### Browser preview (works right now — no Rust needed)

The entire Phase 1 shell is frontend, so you can see all of it in a browser:

```bash
cd raspberry
npm install
npm run dev
```

Then open **http://localhost:5173**.

### Native window (the real Tauri app — real system data)

Prerequisites are already installed on this machine (Rust + the MSVC C++ build
tools + WebView2), and the raspberry app icon is generated
(`apps/hub/src-tauri/icons/`, from `app-icon.svg` via `npm run tauri icon`).

From `raspberry/`:

```bash
npm run tauri:dev     # dev window with hot reload + live system stats
npm run tauri:build   # production installer (.msi / .exe)
```

> First `tauri:dev` compiles the Rust dependency tree (~400 crates, a few
> minutes). Subsequent runs are incremental and fast.

To reproduce the toolchain elsewhere: install Rust from https://rustup.rs and the
"Desktop development with C++" workload (MSVC + Windows SDK), then regenerate
icons with `npm run tauri icon apps/hub/src-tauri/app-icon.svg` from `apps/hub`.

---

## What to look at (verify before Phase 2)

- **Design tokens** — [`apps/hub/src/styles/tokens.css`](apps/hub/src/styles/tokens.css):
  the exact §5 palette (matte black, raspberry `#E11D48`, purple `#7C3AED`,
  frosted `--surface`) as CSS variables. Everything else references these.
- **`<GlassPanel>`** — [`apps/hub/src/ui/GlassPanel.tsx`](apps/hub/src/ui/GlassPanel.tsx):
  blur(24px), hairline stroke, 16px radius, spring-on-enter, raspberry glow on hover.
- **Module registry** — [`apps/hub/src/modules/`](apps/hub/src/modules): the sidebar,
  router, and command palette all read from `registry`. Adding a module = add a
  manifest, no layout edits (see below).
- **Command palette** — `Ctrl+K`. Ranking logic is isolated and tunable in
  [`apps/hub/src/command/matchCommands.ts`](apps/hub/src/command/matchCommands.ts).

---

## Structure

```
raspberry/
├─ package.json            # npm workspace root (dev / build / tauri scripts)
├─ Cargo.toml              # Rust workspace (core + hub; agent joins later)
├─ crates/
│  └─ core/                # SHARED system access (sysinfo): stats, process, files
│     └─ src/              #   Monitor + stats.rs / process.rs / files.rs
└─ apps/
   └─ hub/                 # the Tauri app
      ├─ src/              # React frontend
      │  ├─ styles/        # tokens.css (§5) + global.css (ambient backdrop)
      │  ├─ ui/            # GlassPanel, LiveChart, Meter, PanelShell, IconButton, …
      │  ├─ layout/        # TopBar, Sidebar, Workspace, StatusBar, MachineChip, AppShell
      │  ├─ modules/       # registry + manifests + one folder per tool
      │  │                 #   command-deck/ terminal/ commands/ system-monitor/
      │  │                 #   process-explorer/ network/ lan-manager/ files/
      │  │                 #   storage/ security/ logs/ dev-toolbox/ graphs/
      │  ├─ target/        # Target abstraction: LocalTarget (invoke) + MockTarget (browser)
      │  ├─ hooks/         # usePolling, useSeries
      │  ├─ command/       # Ctrl+K palette + tunable match/rank
      │  ├─ state/         # Zustand shell store
      │  └─ lib/           # cn(), format(), bus (cross-module events), mock
      └─ src-tauri/        # Rust: window + Tauri commands bridging core, icons, config
```

### How a module gets real data (§12 transport abstraction)

Every module talks to a `Target`, never directly to the OS:

```
Module → target.systemSnapshot() ──┬─ LocalTarget  → invoke("system_snapshot") → Rust core (localhost)
                                    └─ MockTarget   → believable fake data (browser preview)
```

`src/target/index.ts` picks `LocalTarget` inside Tauri and `MockTarget` in a
plain browser. Phase 5 adds `RemoteTarget` (mTLS WebSocket to an Agent) behind
the same interface — modules won't change.

### Adding a module later

The spec's promise (§12) — drop in and register, no layout changes:

1. Create `src/modules/<your-id>/` with a `manifest.ts` exporting a `ModuleManifest`
   (`{ id, label, route, icon, description, section, Component }`).
2. Add it to the array in [`manifests.tsx`](apps/hub/src/modules/manifests.tsx)
   (or call `registry.register(...)` from your module).

The sidebar rail, workspace router, and command palette pick it up automatically.

---

## Design rules honored

- **Motion:** GPU transforms/opacity only, 130ms ease-out on hover, spring on panel enter (Framer Motion).
- **Minimalist:** empty by default; detail blooms on hover/focus.
- **TypeScript strict** (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **Fonts:** Inter (UI) + JetBrains Mono (numbers/metrics), bundled via `@fontsource` so the Tauri window works offline.

---

*Raspberry: one panel, every machine, all yours.*

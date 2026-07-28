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

Next: Phase 5 — Agent binary + mTLS transport (drive a second machine remotely).

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
      │  ├─ modules/       # registry + manifests; system-monitor/ process-explorer/ graphs/ files/
      │  ├─ target/        # Target abstraction: LocalTarget (invoke) + MockTarget (browser)
      │  ├─ hooks/         # usePolling, useSeries
      │  ├─ command/       # Ctrl+K palette + tunable match/rank
      │  ├─ state/         # Zustand shell store
      │  └─ lib/           # cn(), format(), mock.ts
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

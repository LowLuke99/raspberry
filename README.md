# Raspberry 🍇

> One glass panel, every machine on your LAN. Minimal surface, deep power.

**Phase 1 — Shell & Design System.** This is the visual skeleton only: matte-black
glass UI, design tokens, top bar, collapsible sidebar rail, routed (empty) module
panels, bottom status bar, and a `Ctrl+K` command palette. **No system
functionality yet** — everything is localhost + clearly-labelled mock data. Real
stats, terminal, networking, and the agent arrive in Phase 2+.

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

### Native window (the real Tauri app)

The matte-black desktop window is compiled by Rust. Two one-time prerequisites:

1. **Install Rust** — https://rustup.rs (plus the WebView2 runtime, which ships
   with Windows 11).
2. **Generate app icons** (Tauri needs them to bundle):
   ```bash
   cd raspberry/apps/hub
   npm run tauri icon path/to/a-1024x1024.png
   ```

Then, from `raspberry/`:

```bash
npm run tauri:dev     # dev window with hot reload
npm run tauri:build   # production installer
```

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
└─ apps/
   └─ hub/                 # the Tauri app
      ├─ src/              # React frontend (Phase 1 lives here)
      │  ├─ styles/        # tokens.css (§5) + global.css (ambient backdrop)
      │  ├─ ui/            # design system: GlassPanel, IconButton, Logo, placeholder
      │  ├─ layout/        # TopBar, Sidebar, Workspace, StatusBar, MachineChip, AppShell
      │  ├─ modules/       # registry + types + manifests (the 12 tools + Command Deck)
      │  ├─ command/       # Ctrl+K palette + tunable match/rank
      │  ├─ state/         # Zustand shell store
      │  └─ lib/           # cn() helper + mock.ts (all fake data, one place)
      └─ src-tauri/        # Rust: frameless window, config, capabilities
```

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

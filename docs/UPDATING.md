# Updating

## The one-click way

Double-click **Update Raspberry** on your Desktop. That's it.

Under the hood the shortcut runs
[`scripts/Update-Raspberry.ps1`](../scripts/Update-Raspberry.ps1), which:

1. Closes any running Raspberry window.
2. `git pull --ff-only` against `main`.
3. `npm install` **only if** `package.json` or `package-lock.json` changed
   (skips it otherwise — big time saver).
4. `npm run tauri:build` to recompile the native app.
5. Launches the fresh `Raspberry.exe`.

Progress prints as it goes. A log line lands in `update.log` at the repo root
each time you run it.

---

## Common gotchas

**"git pull failed"** — you have local edits. Either commit them, or:

```powershell
cd C:\Users\lukep\OneDrive\Documents\ClaudeProject\raspberry
git stash
```

Then double-click **Update Raspberry** again.

**"npm run tauri:build failed"** — usually a Rust or C++ toolchain
mismatch. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#build-failures).

**Nothing happens when I double-click Raspberry** — the app hasn't been built
yet on this machine. Run **Update Raspberry** once first; the plain Raspberry
shortcut is just a fast launcher for the already-built exe.

---

## Manual update (if the shortcut is missing)

```powershell
cd C:\Users\lukep\OneDrive\Documents\ClaudeProject\raspberry
git pull
npm install
npm run tauri:build
apps\hub\src-tauri\target\release\Raspberry.exe
```

Or re-create the shortcuts by double-clicking `Install-Raspberry.bat` at the
repo root.

---

## What's inside `scripts/`

| File | Purpose |
|---|---|
| `Update-Raspberry.ps1` | Full update pipeline (pull, install if needed, build, launch). |
| `Launch-Raspberry.ps1` | Just runs the built exe. No rebuild. |
| `Install-Shortcuts.ps1` | Creates the two Desktop shortcuts. |

You can pin either PS script or shortcut to your taskbar / Start menu — right-
click → "Pin to Start" or "Pin to taskbar".

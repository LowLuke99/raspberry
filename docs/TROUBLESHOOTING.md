# Troubleshooting

Common issues and quick fixes, roughly ordered by how often they hit.

---

## Port 5173 is already in use

```
Error: Port 5173 is already in use
```

A stale Vite dev server (or another app) is holding the port. Kill it:

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Then re-run **Update Raspberry** (or `npm run tauri:dev`).

---

## `sherlock : The term 'sherlock' is not recognized`

The Identity module builds the command, but the tool itself is Python and
isn't installed yet. Copy the "First-time setup" line from the bottom of the
Identity panel, or run:

```powershell
python -m pip install --user pipx
python -m pipx ensurepath
pipx install holehe
pipx install sherlock-project
```

**Close and reopen PowerShell** after — `ensurepath` only affects new shells.

Same fix applies to `holehe`.

---

## `python : The term 'python' is not recognized`

Python isn't installed. Install it and Sherlock/Holehe together:

```powershell
winget install --id Python.Python.3.12 -e
```

Restart PowerShell, then run the pipx block above.

---

## The Desktop shortcut opens PowerShell but then closes instantly

Windows PowerShell is blocking the script from running due to execution
policy. The shortcut already passes `-ExecutionPolicy Bypass`, but sometimes
group policy overrides it. Unblock the script files once:

```powershell
Get-ChildItem "C:\Users\lukep\OneDrive\Documents\ClaudeProject\raspberry\scripts" -Filter *.ps1 |
  Unblock-File
```

Then re-run the shortcut.

---

## Build failures

### `error: linker 'link.exe' not found`

The C++ build tools aren't installed. Install them:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Then close every PowerShell window and re-run **Update Raspberry**.

### `error: could not find 'Cargo.toml'` / cargo not found

Rust isn't installed. Install it:

```powershell
winget install --id Rustlang.Rustup -e
```

Close PowerShell, reopen, then re-run **Update Raspberry**.

### `npm ERR! ... EACCES`

Delete the node cache and retry:

```powershell
cd C:\Users\lukep\OneDrive\Documents\ClaudeProject\raspberry
Remove-Item -Recurse -Force node_modules, apps\hub\node_modules -ErrorAction SilentlyContinue
```

Then double-click **Update Raspberry**.

---

## The app opens but modules are empty / missing

You're looking at an older build. Double-click **Update Raspberry** to
rebuild.

If it still looks the same after the rebuild, force a full recompile:

```powershell
cd C:\Users\lukep\OneDrive\Documents\ClaudeProject\raspberry\apps\hub\src-tauri
Remove-Item -Recurse -Force target -ErrorAction SilentlyContinue
```

Then re-run **Update Raspberry**. This one triggers the ~400-crate cold
build again (~5 min).

---

## LocalSend can't reach my other device

- Both devices need to be on the **same LAN** (same Wi-Fi network).
- LocalSend uses **TCP port 53317**. Allow it through Windows Firewall the
  first time it's used (the OS asks — pick "Private networks").
- Enter the peer's IP **exactly as LocalSend shows it** (bottom-left of the
  official app). Include the port only if it's not the default 53317.

---

## The Terminal panel is stuck / blank

The Terminal only works in the **native** app (needs a real PTY). In the
browser preview it shows a "native only" notice. Run the native app via the
Desktop shortcut.

---

## Still stuck?

Open an issue: <https://github.com/LowLuke99/raspberry/issues> with the
contents of `update.log` (at the repo root) attached. That log has every
step of the last update run.

# Setup — first time on a new PC

You need this once per machine. After it, [Updating](UPDATING.md) is a single
double-click.

---

## 1. Install the toolchain

Raspberry is a native Windows app (Tauri + Rust + React) so you need three
build tools. `winget` installs all of them.

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

The last one (VS Build Tools) is the C++ compiler Rust links against. It's
big (~5 GB) but only installs once.

**Close and reopen PowerShell** after these finish so PATH updates.

---

## 2. Clone the repo

```powershell
cd C:\Users\lukep\OneDrive\Documents\ClaudeProject
git clone https://github.com/LowLuke99/raspberry.git
cd raspberry
```

Path doesn't matter, but the update / launcher shortcuts will point at
wherever you cloned it.

---

## 3. Install desktop shortcuts

Double-click **`Install-Raspberry.bat`** at the repo root. It puts two icons
on your Desktop:

| Shortcut | What it does |
|---|---|
| **Raspberry** | Opens the app. Fast — no rebuild. |
| **Update Raspberry** | `git pull` + rebuild + open. Run this whenever you want the latest changes. |

Re-run the .bat any time you want the shortcuts refreshed (safe to run
repeatedly).

---

## 4. Build for the first time

Double-click **Update Raspberry** on your Desktop. First run compiles ~400
Rust crates — expect a coffee break. Subsequent runs are incremental (~30 s).

When it finishes, Raspberry opens automatically. From now on:

- **Daily use**: double-click **Raspberry** on the Desktop.
- **Get new features**: double-click **Update Raspberry**.

---

## 5. Optional — install the OSINT tools for the Identity module

The Identity module builds Sherlock/Holehe commands, but the tools themselves
are Python. One-time install:

```powershell
winget install --id Python.Python.3.12 -e
python -m pip install --user pipx
python -m pipx ensurepath
```

Close and reopen PowerShell, then:

```powershell
pipx install holehe
pipx install sherlock-project
```

Now `sherlock somehandle` and `holehe someone@gmail.com` work from any shell.

---

## Something broke?

Head to [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

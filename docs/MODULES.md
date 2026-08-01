# Modules

Every panel in the sidebar. Read-only unless noted. Nothing runs without an
explicit click.

## Deck

| Module | What it does |
|---|---|
| **Command Deck** | Home screen. Live CPU/RAM/net/proc tiles + volume strip + jump grid. |

## Shell

| Module | What it does |
|---|---|
| **Terminal** | Real tabbed PowerShell / CMD / WSL. Native app only. |
| **Commands** | Searchable Windows command library. Copy to clipboard or send to Terminal. |
| **Packages** | [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) frontend — Installed / Upgradable / Search tabs. Install, upgrade, upgrade-all, or uninstall from the UI. Read-only on remote agents. |
| **Sysinfo Card** | System identity via [fastfetch](https://github.com/fastfetch-cli/fastfetch) — OS, host, kernel, uptime, CPU/GPU, memory, disks. Card + raw JSON views. |
| **Tweaks** | Curated ChrisTitusTech/winutil-style tweaks (install kits, debloat, privacy, perf, fixes, UI). Same copy / run pattern as Commands. |
| **Identity** | OSINT — Sherlock (username) + Holehe (email). Needs `pipx install holehe sherlock-project`. |
| **LocalSend** | Send files to any [LocalSend](https://github.com/localsend/localsend) peer on your LAN. Drag-drop + peer by IP. |
| **Kernel Inspector** | Deep native process/service/handle inspector powered by [System Informer](https://github.com/winsiderss/systeminformer). PID field + 8 one-click actions. |

## System

| Module | What it does |
|---|---|
| **System Monitor** | Live CPU cores + RAM + net + disk activity. |
| **Process Explorer** | Sortable process list with CPU/mem/status; kill with confirm. |
| **Network** | Local IP, gateway, adapters (MAC + IPv4). |
| **Local Network Manager** | Fast ARP scan + **Deep Scan** (parallel `/24` ping-sweep with hostname + RTT), OUI vendor lookup, Wake-on-LAN. See [LAN Manager Deep Scan](#lan-manager-deep-scan). |
| **Files** | Browse local tree with sizes + drives. |
| **Storage** | Volume rings + physical disk table (SSD/HDD/USB, health). |
| **Security** | Defender + Firewall + BitLocker + UAC + last 20 updates + posture score. |
| **Graphs** | Live line charts for CPU/mem/net. |
| **Logs** | Windows Event Log viewer — System / Application / Security. |
| **Toolbox** | Practical, offline utilities — TCP port check, secure password generator, WiFi/URL QR codes, UUID v4, Unix timestamp. See [Toolbox](#toolbox). |

## Coming later

Modules with a sidebar entry but no panel yet: **SSH**, **Automation**. They
render the placeholder screen — safe to open, does nothing.

---

## First-time tool installs

Some modules shell out to a tool that isn't shipped with Raspberry:

| Module | External tool | Install |
|---|---|---|
| Identity | Holehe + Sherlock | `pipx install holehe sherlock-project` (see [Setup](SETUP.md#5-optional--install-the-osint-tools-for-the-identity-module)) |
| LocalSend | LocalSend desktop app (as a peer) | `winget install --id LocalSend.LocalSend -e` |
| Kernel Inspector | System Informer | `winget install --id WinsiderSS.SystemInformer -e` |
| Kernel Inspector (advanced) | Sysinternals PsSuspend / ProcDump / Handle | `winget install --id Microsoft.Sysinternals.Suite -e` |
| Sysinfo Card | Fastfetch | `winget install --id Fastfetch-cli.Fastfetch -e` |
| Packages | winget (built-in on Windows 11) | preinstalled — nothing to do |

Every module has a copy-to-clipboard button for its install command, so you
don't need to memorize any of the above.

---

## LAN Manager Deep Scan

The default **Rescan** button reads Windows' ARP cache. That cache only
holds hosts your PC has spoken to in the last ~2 minutes, so a fresh cache
often looks nearly empty even on a busy LAN.

**Deep Scan** fixes this: 32 parallel workers fan `ping -a -n 1 -w 250`
across every host on your `/24`. Anything that answers gets an ARP entry
as a byproduct, and each row is enriched with:

- **Hostname** — resolved via `ping -a` (reverse DNS / NetBIOS)
- **RTT** — round-trip time in ms, color-coded (green <10, amber <50)

The full sweep completes in ~1–3s on most LANs. Devices are IP-sorted
naturally (`.9` before `.10`), and the filter box searches IP, hostname,
vendor, and MAC.

## Remote agents

A separate binary — [`raspberry-agent`](AGENT.md) — lets a Hub on one PC
observe another PC over the LAN. Add machines via the top-left chip; the
whole app retargets on click. Read-only in v0.1. Full details in
[AGENT.md](AGENT.md).

## Toolbox

Six little tools that all fit the "controlling a machine on your LAN" theme.
Everything runs locally — nothing on this panel makes a network request
except **Port Check**, which does a bounded (1.5s) TCP connect from your
Hub.

| Tab | What it does |
|---|---|
| **Port Check** | TCP connect to `host:port` with hostname resolution + latency. Quick-buttons for SSH · HTTP · HTTPS · RDP · VNC · Raspberry Agent (:8848). |
| **Password** | Cryptographically-random password (`crypto.getRandomValues`). Toggle a-z / A-Z / 0-9 / symbols; live entropy read-out (strong ≥ 128 bits). |
| **QR** | Any text or URL → QR code (transparent PNG, error-correction M). Great for one-off links or shared config strings. |
| **WiFi QR** | Generates a proper `WIFI:S:…;T:…;P:…;;` code — point any phone camera and it joins. Supports WPA/WEP/Open + hidden SSIDs. Nothing leaves your PC. |
| **UUID** | Five v4 UUIDs per click, each with a copy button. |
| **Timestamp** | Unix ↔ ISO 8601 / local / UTC, with a live "now" tick every second. |

## Machine switching (Ctrl+K)

The command palette now surfaces a `Switch to: <machine>` entry for every
registered agent (plus **This PC**). Open the palette (`Ctrl+K`), type a
machine name, hit Enter — the whole app retargets without touching the
top-bar chip.

**Live health polling (Phase 7):** the chip now probes every registered
agent's `/health` endpoint every 5 seconds. Each row in the popover shows
a colored status dot and the last measured RTT:

- **green** — up and responsive (≤ 1.2s round-trip)
- **amber** — reachable but slow (agent under load)
- **red** — probe failed or timed out
- **grey** — never probed yet (fresh add, first tick pending)

The active-machine chip itself takes the color of the selected agent, so
you can see at a glance whether the machine you're driving is actually
healthy — no need to open the popover.

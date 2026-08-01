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
| **Dev Toolbox** | JSON pretty-print, Base64, UUID, SHA-256, timestamps. Offline. |

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

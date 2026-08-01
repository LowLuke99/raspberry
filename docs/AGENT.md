# Remote Agent

`raspberry-agent` is a small Rust binary you run on a PC you want to observe
from your main Raspberry Hub. It wraps the shared `core` crate in an HTTP
server so a Hub anywhere on your LAN can pair with it and monitor that
machine — no cloud, no account.

**v0.1 is read-only.** Snapshot, processes, network, storage, security,
files, logs — all queryable. Process kill / Wake-on-LAN / terminal stay
Hub-local until Phase 6.1 ships mTLS + per-command allow-listing.

---

## Run the agent

```powershell
cd C:\path\to\raspberry
cargo run --release -p raspberry-agent
```

Or use the built binary directly:

```
target\release\raspberry-agent.exe
```

On first launch it creates a config at
`%APPDATA%\Raspberry\agent.toml` with a random 32-char hex token and prints
it to the console:

```
Raspberry Agent v0.1.0 listening on 0.0.0.0:8848
  hostname : STUDIO-01
  token    : 3f2a1c9b7e4d6510a8f3b2c9d1e5670a  ← share this with the Hub
  config   : C:\Users\you\AppData\Roaming\Raspberry\agent.toml
```

Copy the token — you'll paste it into the Hub. Leave the terminal open;
closing it kills the agent. (Windows-service install lands in 6.1.)

---

## Pair the Hub with an agent

1. Open the Hub on your main PC.
2. Click the **machine chip** at the top-left ("This PC").
3. Click **Add machine…**
4. Fill in:
   - **Name** — anything friendly ("Studio", "Homelab", "Bedroom PC")
   - **Base URL** — `http://<agent-lan-ip>:8848`
   - **Bearer token** — the token the agent printed
5. Click **Test & save**. The Hub calls `/health` first; if it can reach the
   agent, the machine appears in your list and becomes active.

Every panel — System Monitor, Process Explorer, Network, LAN Manager,
Storage, Security, Files, Logs, Graphs, Command Deck — now shows the
remote PC's data. Click the chip → **This PC** to snap back.

The list is saved to your Hub's `localStorage` under `raspberry.agents.v1`
so it survives restarts.

---

## What the agent exposes

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /health` | none | Reachability probe. Returns hostname, version, OS. |
| `GET /snapshot` | bearer | Live system snapshot (CPU, RAM, net, disks) |
| `GET /processes` | bearer | Process table |
| `GET /network_info` | bearer | Local IP, gateway, interfaces |
| `GET /network_scan` | bearer | Fast ARP-cache LAN scan |
| `POST /network_scan_deep` | bearer | Active `/24` ping sweep |
| `GET /storage_disks` | bearer | Physical disks + health |
| `GET /security_status` | bearer | Defender / Firewall / BitLocker / hotfixes |
| `GET /files_list?path=…` | bearer | Directory listing |
| `GET /files_home` | bearer | User home dir |
| `GET /files_roots` | bearer | Drive roots |
| `GET /logs/{log}/{max}` | bearer | Event log entries |

Not exposed (deliberately): `process_kill`, `wake_on_lan`, terminal.

---

## Security notes

- Auth is a **pre-shared bearer token** compared in constant time. That is
  fine for a trusted LAN, insufficient for the open internet.
- Traffic is **plain HTTP** in v0.1. Anyone sniffing your LAN can read
  everything the Hub reads. Do not run the agent on a hostile network.
- Don't port-forward the agent to the internet. If you need remote-over-WAN,
  wait for 6.1 (mTLS) or tunnel it through Tailscale / WireGuard.
- The agent binds to `0.0.0.0` so any LAN device can *reach* the port; a
  correct token is still required to get past `/health`.

To rotate the token: edit the `token` value in
`%APPDATA%\Raspberry\agent.toml` and restart the agent, then update the
saved token in the Hub's Add-machine flow (remove + re-add).

---

## Removing an agent

Open the machine chip → hover the agent's row → click the `×`. Confirm.
The Hub deletes it from `localStorage`; the agent process on the other PC
is untouched (stop it there manually).

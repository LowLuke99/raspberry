# Security Policy

## Threat Model — v0.7.x

Raspberry is designed for **LAN-scoped, trusted-network** use. This is not
a hypothetical — it's the deployment target the current code protects
against and the one it doesn't.

### What Raspberry does defend against

- **Casual read-only exposure of your desktop.** The Hub runs locally in a
  Tauri window; nothing is served to the network from it.
- **Unauthorized access to the remote agent.** Every non-`/health`
  endpoint requires a bearer token that's compared in constant time
  (`ct_eq` in `apps/agent/src/main.rs`).
- **Directory traversal via `/files_list`.** Paths are canonicalized and
  matched against an allowlist (user home + drive roots by default). A
  paired Hub cannot walk `\\file-server\hr` even if the agent's user
  account has domain access to it.
- **Winget flag injection.** Package ids passed to install/uninstall/
  upgrade are validated against `[A-Za-z0-9.+_-]+` before reaching the
  `winget` CLI.
- **Web-side XSS becoming RCE.** A strict Content Security Policy
  (`tauri.conf.json` → `security.csp`) restricts scripts to `'self'`.
- **UI crashes from a poisoned mutex.** Every lock uses
  `unwrap_or_else(|e| e.into_inner())` — a single `sysinfo` panic can't
  brick every subsequent Tauri call.

### What Raspberry currently does NOT defend against

- **Passive network eavesdropping on the LAN.** The agent speaks **plain
  HTTP**. Anyone with packet capture on your network (a compromised
  router, a promiscuous adapter, a mis-configured guest VLAN) can read
  the bearer token in the clear on the first Hub request and
  impersonate the Hub afterward.
- **Man-in-the-middle attacks.** No TLS, no cert pinning, no fingerprint
  verification. Anyone able to spoof ARP + inject responses on the LAN
  can serve the Hub whatever it likes.
- **Off-LAN access.** Raspberry has no notion of remote transport, VPN,
  or reverse tunnel. Do not port-forward `8848` to the public internet.
- **Multi-user isolation.** There is one bearer token per agent. Anyone
  who can read `%APPDATA%\Raspberry\agent.toml` (or the Hub's
  `localStorage`) has full access.
- **Tampering with the agent config or the update pipeline.** No
  signature verification on `git pull` in `Update-Raspberry.ps1`; no
  signed binaries.

### Phase 8 (hardening) — planned mitigations

- **rustls + rcgen self-signed cert** on the agent (`https://` transport).
- **First-connect fingerprint pinning** by the Hub (TOFU model, like SSH).
- **Optional mTLS** — Hub gets a client cert, agent verifies it.
- **Windows Service installer** so the agent doesn't require a logged-in
  console session.
- **Token stored in Windows Credential Manager** on the Hub side
  (`keyring` crate), not `localStorage`.

Until Phase 8 ships, treat every registered agent as "trust the LAN it
sits on."

## Deployment posture recommendations

If you run Raspberry as intended (single home LAN, no untrusted devices
on the same subnet), it is fine.

If any of the below is true, wait for Phase 8:

- You share your LAN with untrusted devices (public Wi-Fi, coworking
  space, guest network).
- You want to reach your PC from off-LAN.
- Multiple people log into the machine running the agent.
- You need audit logging of who did what on managed machines.

## Reporting a vulnerability

If you find a security issue, please open a **private security advisory**
via the GitHub UI:

  https://github.com/LowLuke99/raspberry/security/advisories/new

Do not open a public issue for security bugs. If GitHub advisories are
unavailable to you, email the maintainer directly (address in the
top-level repo commit history) with a short description and a
reproduction if possible. Please include:

- Affected version (`raspberry-core` / `raspberry-hub` / `raspberry-agent`
  version — printed on agent startup and in `Cargo.toml`).
- Repro steps or PoC.
- The impact you observed (info disclosure, code execution, DoS, etc.).

You can expect an initial acknowledgement within a few days. Raspberry
is a hobby project — please be patient with response times.

## Scope

**In scope:**

- Anything in `crates/core`, `apps/agent`, `apps/hub`.
- The updater scripts (`scripts/Update-Raspberry.ps1`,
  `Install-Raspberry.bat`).
- CI workflows.

**Out of scope:**

- Vulnerabilities in upstream crates (`sysinfo`, `axum`, `tauri`,
  `netdev`, etc.) — report those to their maintainers directly.
- Anything that requires the attacker to already be admin on the target
  machine.
- Anything that requires the attacker to already be on the LAN and know
  the bearer token — that's the documented threat model above, not a
  bug.

## Disclosure

We prefer coordinated disclosure. Once a fix ships in a release, the
security advisory becomes public with credit to the reporter (unless
you'd rather stay anonymous).

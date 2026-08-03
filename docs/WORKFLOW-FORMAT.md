# Workflow Format (v1)

> Reference spec for Raspberry workflow JSON. See
> `docs/project-audit/OSINT-PLATFORM-ROADMAP.md` §5 for context.

A **workflow** is a directed acyclic graph of plugin invocations. Each
**node** invokes a provider (e.g. `domain.whois`). Each **edge** carries a
typed entity (e.g. `domain`, `ip`, `email`) from one node's output port to
another node's input port. The engine executes nodes as soon as their input
ports have received at least one value.

## Wire format

```jsonc
{
  "$schema": "https://raspberry.local/schema/workflow-v1.json",
  "id": "workflow-domain-recon-basic",
  "name": "Domain recon → HTTPX → screenshot → HTML report",
  "description": "Baseline external footprint of a single domain.",
  "version": "1",
  "created_at": "2026-08-02T14:00:00Z",

  "inputs": [
    { "id": "target_domain", "kind": "domain", "label": "Target domain" }
  ],

  "nodes": [
    { "id": "src",    "provider": "input:domain",       "config": { "bind": "target_domain" } },
    { "id": "whois",  "provider": "domain.whois",       "config": {} },
    { "id": "dns",    "provider": "domain.dns",         "config": { "records": ["A", "AAAA", "MX", "NS", "TXT", "CAA"] } },
    { "id": "ct",     "provider": "domain.ct-logs",     "config": { "limit": 500 } },
    { "id": "subs",   "provider": "domain.subfinder",   "config": { "sources": ["ct", "hackertarget", "otx"] } },
    { "id": "httpx",  "provider": "web.httpx",          "config": { "ports": [80, 443, 8080, 8443], "timeout_ms": 5000 } },
    { "id": "shots",  "provider": "web.screenshot",     "config": { "viewport": "1440x900", "wait_ms": 1500 } },
    { "id": "report", "provider": "report.html",        "config": { "template": "domain-recon-v1" } }
  ],

  "edges": [
    { "from": { "node": "src",    "port": "out" }, "to": { "node": "whois", "port": "in" } },
    { "from": { "node": "src",    "port": "out" }, "to": { "node": "dns",   "port": "in" } },
    { "from": { "node": "src",    "port": "out" }, "to": { "node": "ct",    "port": "in" } },
    { "from": { "node": "src",    "port": "out" }, "to": { "node": "subs",  "port": "in" } },
    { "from": { "node": "subs",   "port": "out" }, "to": { "node": "httpx", "port": "in" } },
    { "from": { "node": "ct",     "port": "out" }, "to": { "node": "httpx", "port": "in" } },
    { "from": { "node": "httpx",  "port": "out" }, "to": { "node": "shots", "port": "in" } },
    { "from": { "node": "whois",  "port": "out" }, "to": { "node": "report", "port": "in" } },
    { "from": { "node": "dns",    "port": "out" }, "to": { "node": "report", "port": "in" } },
    { "from": { "node": "shots",  "port": "out" }, "to": { "node": "report", "port": "in" } }
  ],

  "settings": {
    "max_parallel_nodes": 4,
    "per_provider_qps": 2,
    "cache": "shared",
    "on_error": "continue"
  }
}
```

## Validation rules

1. **Unique node ids** — the graph is a `HashMap<NodeId, Node>` in memory.
2. **No cycles** — validated with Tarjan SCC at load time.
3. **Type-safe edges** — a `from.port` output kind (declared by the plugin's
   `outputSchema`) must appear in `to.port` input kinds (`inputSchema`). The
   graph editor refuses illegal wiring at edit time; the loader refuses it
   at run time.
4. **Bound inputs** — every input in `inputs[]` must be referenced by exactly
   one Source node's `config.bind`.
5. **Reachable sinks** — every terminal node must be a `Sink` (its plugin's
   `capabilities` include `"reporting"` or `"automation"`) or the engine
   emits a warning that the run has no persistent output.

## Execution semantics

- Node fires when **every** input port has at least one value queued.
- Multiple values on the same input port fan out — the node runs once per
  input value, unless `config.batch: true`.
- Node output is broadcast to every downstream edge — a node with 3
  consumers does NOT re-run 3×.
- `settings.on_error`: `"continue"` (default), `"halt"`, or `"retry:N"`.

## Sharing

A workflow is JSON on disk under `%APPDATA%/Raspberry/workflows/`. The
Workflows module supports drag-drop import and export-to-file. A future
plugin marketplace can distribute workflows the same way it distributes
plugins — as git repos containing `workflow.json` + `README.md`.

## Compatibility

- `version: "1"` is frozen. Additive fields (new node config keys, new
  settings) are safe. Breaking changes bump `version: "2"` and the loader
  branches.
- Unknown node config keys are preserved (round-trip safe) and warned once.

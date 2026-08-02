import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Pause,
  Play,
  Copy,
  Check,
  ShieldAlert,
  Radio,
  Globe,
  Server,
  Cpu,
  Filter,
  X,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { ConnectionSnapshot, NetConnection } from "@/target";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

/** Refresh cadence when live-streaming. 2s is a sweet spot between "feels
 *  live" and "PowerShell isn't a socket subscription — don't hammer it". */
const REFRESH_MS = 2000;

/** Common well-known ports we label inline so a glance at the table tells the
 *  story without a second lookup. Kept curated — the "what is that port"
 *  reflex answers 90% of what people wonder about while watching traffic. */
const PORT_LABELS: Record<number, string> = {
  20: "FTP", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
  67: "DHCP", 68: "DHCP", 69: "TFTP", 80: "HTTP", 110: "POP3", 111: "RPC",
  123: "NTP", 135: "RPC", 137: "NetBIOS", 138: "NetBIOS", 139: "SMB",
  143: "IMAP", 161: "SNMP", 162: "SNMP", 179: "BGP", 194: "IRC", 389: "LDAP",
  427: "SLP", 443: "HTTPS", 445: "SMB", 465: "SMTPS", 500: "IKE", 514: "Syslog",
  515: "LPD", 520: "RIP", 546: "DHCPv6", 547: "DHCPv6", 587: "SMTP",
  631: "IPP", 636: "LDAPS", 853: "DoT", 873: "rsync", 902: "VMware",
  989: "FTPS", 990: "FTPS", 993: "IMAPS", 995: "POP3S",
  1080: "SOCKS", 1194: "OpenVPN", 1433: "MSSQL", 1434: "MSSQL", 1521: "Oracle",
  1701: "L2TP", 1723: "PPTP", 1883: "MQTT", 1900: "SSDP", 2049: "NFS",
  2181: "ZooKeeper", 2375: "Docker", 2376: "Docker",
  3000: "Dev", 3128: "Proxy", 3268: "LDAP-GC", 3306: "MySQL", 3389: "RDP",
  3478: "STUN", 3690: "svn", 4000: "Dev", 4172: "PCoIP", 4200: "Dev",
  4444: "Metasploit", 4500: "IPsec", 4711: "Dev", 4712: "Dev",
  5000: "Dev / UPnP", 5001: "Dev", 5060: "SIP", 5061: "SIPS", 5222: "XMPP",
  5228: "GCM", 5353: "mDNS", 5432: "Postgres", 5555: "adb",
  5672: "AMQP", 5683: "CoAP", 5900: "VNC", 5938: "TeamViewer",
  5985: "WinRM", 5986: "WinRM",
  6000: "X11", 6379: "Redis", 6443: "K8s API", 6463: "Discord RPC",
  6600: "MPD", 6667: "IRC", 6881: "BitTorrent",
  7000: "Dev", 7070: "RealServer", 7443: "Dev",
  8000: "Dev", 8008: "HTTP-alt", 8080: "HTTP-alt", 8081: "Dev",
  8086: "InfluxDB", 8087: "Riak", 8088: "Dev", 8089: "Splunk",
  8125: "StatsD", 8443: "HTTPS-alt", 8500: "Consul", 8888: "Dev",
  9000: "Dev", 9042: "Cassandra", 9092: "Kafka", 9100: "Prometheus",
  9200: "Elastic", 9300: "Elastic", 9418: "git", 9443: "HTTPS-alt",
  9999: "Dev",
  10000: "Webmin", 11211: "Memcached", 15672: "RabbitMQ",
  25565: "Minecraft", 27017: "MongoDB", 27018: "MongoDB",
  32400: "Plex", 33060: "MySQL X",
  47989: "Sunshine", 47990: "Sunshine",
  50051: "gRPC",
};

/** Ports Windows almost never opens outbound in the wild. Presence in the
 *  Established set is worth flagging. */
const SUSPICIOUS_REMOTE_PORTS = new Set([23, 445, 3389, 4444, 5555, 6667]);

type Mode = "all" | "listen" | "established" | "foreign";

/** Watchtower — a live per-process outbound-connection radar. Pulls the
 *  Windows TCP table every 2s, attributes each socket to its owning process,
 *  and highlights anything worth a second look. */
export function WatchtowerPanel({ manifest }: { manifest: ModuleManifest }) {
  const [snap, setSnap] = useState<ConnectionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    // Cancel any in-flight refresh so we don't stampede if a slow tick lands
    // right as the user hits the button.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const s = await target.networkConnections();
      if (ctrl.signal.aborted) return;
      setSnap(s);
      setError(null);
      setLastRefresh(Date.now());
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [live, refresh]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch {
      /* ignore — the row still shows the value */
    }
  }

  const filtered = useMemo(() => {
    const rows = snap?.connections ?? [];
    const q = filter.trim().toLowerCase();
    return rows.filter((c) => {
      if (mode === "listen" && !c.state.toLowerCase().includes("listen")) return false;
      if (mode === "established" && c.state.toLowerCase() !== "established") return false;
      if (mode === "foreign" && !c.foreign) return false;
      if (!q) return true;
      return (
        c.process_name.toLowerCase().includes(q) ||
        c.remote_addr.toLowerCase().includes(q) ||
        c.local_addr.toLowerCase().includes(q) ||
        String(c.remote_port).includes(q) ||
        String(c.local_port).includes(q) ||
        String(c.pid).includes(q) ||
        c.state.toLowerCase().includes(q)
      );
    });
  }, [snap, filter, mode]);

  // Group foreign connections by remote host so the "Top talkers" strip below
  // the table gives a compressed picture of who this machine is chatting to.
  const topTalkers = useMemo(() => {
    const rows = snap?.connections ?? [];
    const byHost = new Map<string, { host: string; count: number; procs: Set<string> }>();
    for (const c of rows) {
      if (!c.foreign) continue;
      const cur = byHost.get(c.remote_addr) ?? { host: c.remote_addr, count: 0, procs: new Set<string>() };
      cur.count += 1;
      if (c.process_name) cur.procs.add(c.process_name);
      byHost.set(c.remote_addr, cur);
    }
    return [...byHost.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [snap]);

  const anomalies = useMemo(() => {
    const rows = snap?.connections ?? [];
    return rows.filter((c) => {
      if (c.state.toLowerCase() === "established" && SUSPICIOUS_REMOTE_PORTS.has(c.remote_port)) return true;
      // Anything listening on 0.0.0.0 above the usual Windows range is worth a
      // note — it's an inbound attack surface across the LAN.
      if (c.listen_any && c.local_port > 10_000) return true;
      return false;
    });
  }, [snap]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-surface-hi px-2.5 text-[12px] text-text transition-colors hover:text-raspberry"
            aria-pressed={live}
            aria-label={live ? "Pause live updates" : "Resume live updates"}
          >
            {live ? <Pause size={13} /> : <Play size={13} />}
            {live ? "Live" : "Paused"}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={loading && !snap}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-[rgba(var(--raspberry-rgb),0.15)] px-2.5 text-[12px] font-medium text-raspberry transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.25)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      }
    >
      {snap && !snap.supported && (
        <GlassPanel interactive={false} className="mb-3 border-amber-300/30 p-3 text-[12px] text-text-dim">
          Watchtower reads the live TCP table via PowerShell — that path is only
          available on Windows. Connect to a Windows agent to see this machine's
          radar.
        </GlassPanel>
      )}

      {error && (
        <GlassPanel interactive={false} className="mb-3 border-[rgba(var(--raspberry-rgb),0.3)] p-3 text-[12px] text-text">
          <span className="text-raspberry">Error:</span> {error}
        </GlassPanel>
      )}

      {/* Summary strip — five KPIs mirroring the ConnectionSnapshot counts. */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat icon={Radio} label="Total" value={snap?.total ?? 0} tone="text" />
        <Stat icon={Server} label="Listening" value={snap?.listening ?? 0} tone="accent" />
        <Stat icon={Globe} label="Established" value={snap?.established ?? 0} tone="emerald" />
        <Stat icon={Globe} label="Foreign hosts" value={snap?.foreign_hosts ?? 0} tone="text" />
        <Stat icon={Cpu} label="Processes" value={snap?.unique_processes ?? 0} tone="text" />
      </div>

      {/* Anomalies — only rendered when there's something to say. */}
      {anomalies.length > 0 && (
        <GlassPanel
          interactive={false}
          className="mb-3 border-[rgba(var(--raspberry-rgb),0.35)] bg-[rgba(var(--raspberry-rgb),0.06)] p-3"
        >
          <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-raspberry">
            <ShieldAlert size={14} />
            {anomalies.length} noteworthy connection{anomalies.length === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {anomalies.slice(0, 12).map((c) => (
              <span
                key={`${c.pid}-${c.local_port}-${c.remote_addr}-${c.remote_port}`}
                className="mono rounded-[6px] bg-surface-hi px-2 py-0.5 text-[11px] text-text-dim"
              >
                {c.process_name || `pid ${c.pid}`}
                <span className="mx-1 opacity-40">→</span>
                {c.foreign ? `${c.remote_addr}:${c.remote_port}` : `listen ${c.local_addr}:${c.local_port}`}
                {SUSPICIOUS_REMOTE_PORTS.has(c.remote_port) && (
                  <span className="ml-1 text-raspberry">
                    ({PORT_LABELS[c.remote_port] ?? "unusual"})
                  </span>
                )}
              </span>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Mode chips + search. Filter is applied on top of the mode. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[9px] bg-surface-hi p-0.5 text-[11px]">
          {(
            [
              ["all", "All"],
              ["listen", "Listening"],
              ["established", "Established"],
              ["foreign", "Foreign only"],
            ] as [Mode, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "focus-ring rounded-[7px] px-2 py-1 transition-colors",
                mode === id ? "bg-[rgba(var(--raspberry-rgb),0.22)] text-text" : "text-text-dim hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Filter
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by process, host, port, pid, state…"
            className="focus-ring h-8 w-full rounded-[9px] bg-surface-hi pl-7 pr-8 text-[12px] text-text placeholder:text-text-dim"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[6px] p-1 text-text-dim hover:text-text"
              aria-label="Clear filter"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span className="mono text-[11px] text-text-dim">
          {filtered.length}/{snap?.connections.length ?? 0}
        </span>
      </div>

      <GlassPanel interactive={false} className="overflow-hidden">
        <div className="grid grid-cols-[70px_1fr_100px_1fr_100px_92px_60px] items-center gap-2 border-b border-stroke px-3 py-2 text-[11px] uppercase tracking-wide text-text-dim">
          <span>PID</span>
          <span>Process</span>
          <span>Local</span>
          <span>Remote</span>
          <span className="text-right">Port</span>
          <span>State</span>
          <span className="text-right">Copy</span>
        </div>
        <div className="max-h-[calc(100vh-500px)] min-h-[280px] overflow-y-auto">
          {filtered.map((c) => {
            const rowKey = `${c.pid}-${c.local_addr}-${c.local_port}-${c.remote_addr}-${c.remote_port}-${c.state}`;
            const copyValue = c.foreign
              ? `${c.remote_addr}:${c.remote_port}`
              : `${c.local_addr}:${c.local_port}`;
            return <ConnectionRow key={rowKey} c={c} rowKey={rowKey} copyValue={copyValue} copiedKey={copiedKey} onCopy={copy} />;
          })}
          {!loading && filtered.length === 0 && snap && (
            <div className="px-4 py-10 text-center text-[13px] text-text-dim">
              <p className="mb-1">Nothing matches the current view.</p>
              <p className="text-[12px] opacity-70">Clear the filter or switch modes above.</p>
            </div>
          )}
          {loading && !snap && (
            <div className="px-4 py-10 text-center text-[13px] text-text-dim">
              Priming the connection table…
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-stroke px-3 py-2 text-[11px] text-text-dim">
          <span>
            {live ? "Refreshing every 2s" : "Live updates paused"}
            {lastRefresh && ` · last ${new Date(lastRefresh).toLocaleTimeString()}`}
          </span>
          <span className="opacity-60">
            Source: Get-NetTCPConnection + Get-Process
          </span>
        </div>
      </GlassPanel>

      {/* Top talkers — only meaningful if there ARE foreign hosts to rank. */}
      {topTalkers.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-text-dim">Top talkers</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {topTalkers.map((t) => (
              <GlassPanel
                key={t.host}
                interactive={false}
                className="flex items-center justify-between px-3 py-2 text-[12px]"
              >
                <div className="min-w-0">
                  <div className="mono truncate text-text">{t.host}</div>
                  <div className="truncate text-[11px] text-text-dim">
                    {[...t.procs].slice(0, 3).join(", ") || "—"}
                  </div>
                </div>
                <span className="mono rounded-[6px] bg-surface-hi px-2 py-0.5 text-[11px] text-text-dim">
                  {t.count}×
                </span>
              </GlassPanel>
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

/** One row of the connection table. Extracted so the parent doesn't re-render
 *  the map body on every keystroke of the filter box. */
function ConnectionRow({
  c,
  rowKey,
  copyValue,
  copiedKey,
  onCopy,
}: {
  c: NetConnection;
  rowKey: string;
  copyValue: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const stateLc = c.state.toLowerCase();
  return (
    <div className="group grid grid-cols-[70px_1fr_100px_1fr_100px_92px_60px] items-center gap-2 border-b border-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[12px] hover:bg-surface-hi">
      <span className="mono text-text-dim">{c.pid || <span className="opacity-40">—</span>}</span>
      <span className="truncate text-text" title={c.process_path ?? c.process_name}>
        {c.process_name || <span className="text-text-dim">unknown</span>}
      </span>
      <span className="mono truncate text-text-dim" title={c.local_addr}>
        {shortAddr(c.local_addr)}
        <span className="opacity-40">:</span>
        {c.local_port}
      </span>
      <span className="mono flex items-center gap-1.5 truncate text-text-dim">
        {c.foreign ? (
          <>
            <Globe size={11} className="shrink-0 text-emerald-400/70" />
            <span className="truncate text-text" title={c.remote_addr}>
              {c.remote_addr}
            </span>
          </>
        ) : stateLc.includes("listen") ? (
          <>
            <Server size={11} className="shrink-0 text-raspberry" />
            <span className="opacity-50">— {c.listen_any ? "any" : "loopback"}</span>
          </>
        ) : (
          <span className="opacity-50">{c.remote_addr || "—"}</span>
        )}
      </span>
      <span className="mono flex items-center justify-end gap-1 text-right">
        <span className="text-text">{c.remote_port || c.local_port}</span>
        {(() => {
          const p = c.foreign ? c.remote_port : c.local_port;
          const label = PORT_LABELS[p];
          if (!label) return null;
          return (
            <span
              className={cn(
                "rounded-[5px] px-1.5 py-0.5 text-[10px]",
                SUSPICIOUS_REMOTE_PORTS.has(p) && c.foreign
                  ? "bg-[rgba(var(--raspberry-rgb),0.25)] text-raspberry"
                  : "bg-surface-hi text-text-dim",
              )}
              title={`Well-known port: ${label}`}
            >
              {label}
            </span>
          );
        })()}
      </span>
      <span>
        <StatePill state={c.state} />
      </span>
      <span className="text-right">
        <button
          type="button"
          onClick={() => onCopy(copyValue, rowKey)}
          className="focus-ring inline-flex items-center gap-1 rounded-[6px] p-1 text-text-dim opacity-0 transition-opacity hover:text-raspberry group-hover:opacity-80"
          aria-label={`Copy ${copyValue}`}
          title={`Copy ${copyValue}`}
        >
          {copiedKey === rowKey ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
      </span>
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const lc = state.toLowerCase();
  const tone =
    lc === "established"
      ? "bg-emerald-500/15 text-emerald-300"
      : lc === "listen"
        ? "bg-[rgba(var(--raspberry-rgb),0.18)] text-raspberry"
        : lc.includes("wait")
          ? "bg-surface-hi text-text-dim"
          : "bg-surface-hi text-text-dim";
  return <span className={cn("mono rounded-[5px] px-1.5 py-0.5 text-[10px]", tone)}>{state}</span>;
}

/** IPv6 addresses are long — trim to keep the row height stable. */
function shortAddr(addr: string): string {
  if (addr.length > 22 && addr.includes(":")) return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
  return addr;
}

type IconEl = typeof Cpu;

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: IconEl;
  label: string;
  value: number;
  tone: "text" | "accent" | "emerald";
}) {
  const toneCls =
    tone === "accent" ? "text-raspberry" : tone === "emerald" ? "text-emerald-400" : "text-text";
  return (
    <GlassPanel interactive={false} className="flex items-center gap-3 px-3 py-2">
      <div className={cn("grid h-7 w-7 place-items-center rounded-[8px] bg-surface-hi", toneCls)}>
        <Icon size={13} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className={cn("mono text-[16px] leading-none", toneCls)}>{value.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wide text-text-dim">{label}</div>
      </div>
    </GlassPanel>
  );
}

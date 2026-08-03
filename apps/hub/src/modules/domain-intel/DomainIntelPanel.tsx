import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Globe,
  Search,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Shield,
  Fingerprint,
  Network,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { isTauri } from "@/target";

/**
 * DomainIntelReport — mirror of the Rust struct in
 * `apps/hub/src-tauri/src/lib.rs::domain_intel`. Kept typed inline because
 * Domain Intel is Hub-local (remote agents don't run OSINT providers).
 */
interface Finding {
  kind: string;
  value: string;
  source: string;
  confidence: number;
  detail?: unknown;
}
interface DomainIntelReport {
  domain: string;
  findings: Finding[];
  errors: string[];
}

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function DomainIntelPanel({ manifest }: { manifest: ModuleManifest }) {
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<DomainIntelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const canRun = useMemo(() => DOMAIN_RE.test(query.trim()), [query]);

  const run = useCallback(async () => {
    if (!canRun) return;
    if (!isTauri()) {
      setError("Domain Intel needs the native app — the browser preview can't reach the OSINT providers.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const r = await invoke<DomainIntelReport>("domain_intel", { domain: query.trim() });
      setReport(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [canRun, query]);

  const grouped = useMemo(() => {
    if (!report) return null;
    const buckets = new Map<string, Finding[]>();
    for (const f of report.findings) {
      const key = bucketFor(f);
      const arr = buckets.get(key) ?? [];
      arr.push(f);
      buckets.set(key, arr);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [report]);

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1200);
  }, []);

  return (
    <PanelShell manifest={manifest}>
      <GlassPanel className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 focus-within:border-white/25 transition">
            <Search className="w-4 h-4 opacity-60" />
            <input
              type="text"
              value={query}
              placeholder="example.com"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              className="flex-1 bg-transparent outline-none text-sm font-mono"
              autoFocus
            />
          </div>
          <button
            onClick={run}
            disabled={!canRun || loading}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition",
              canRun && !loading
                ? "bg-white/15 hover:bg-white/25 border border-white/20"
                : "bg-white/5 border border-white/10 opacity-50 cursor-not-allowed",
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Investigating…
              </span>
            ) : (
              "Investigate"
            )}
          </button>
        </div>

        <p className="text-xs text-white/50">
          Passive lookups only — WHOIS/RDAP, DNS (A/AAAA/MX/NS/TXT), and Certificate
          Transparency via crt.sh. Nothing hits the target host directly.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </GlassPanel>

      {report && (
        <div className="space-y-4">
          {report.errors.length > 0 && (
            <GlassPanel className="p-4">
              <div className="text-xs text-amber-300/80 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Partial results — some providers failed:
              </div>
              <ul className="text-xs text-white/60 space-y-1 font-mono">
                {report.errors.map((e) => (
                  <li key={e}>· {e}</li>
                ))}
              </ul>
            </GlassPanel>
          )}

          {grouped && grouped.length === 0 && (
            <GlassPanel className="p-6 text-center text-sm text-white/60">
              No findings. That's a real signal too — the target may not exist, or
              every provider is currently unreachable.
            </GlassPanel>
          )}

          {grouped?.map(([bucket, items]) => (
            <GlassPanel key={bucket} className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-white/80">
                {iconFor(bucket)}
                <span>{bucket}</span>
                <span className="text-xs text-white/40">· {items.length}</span>
              </div>
              <ul className="space-y-1">
                {items.map((f, i) => (
                  <li
                    key={`${f.kind}-${f.value}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-md hover:bg-white/5 px-2 py-1.5 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-mono truncate">{f.value}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">
                        {f.kind} · {f.source} · {(f.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <button
                      onClick={() => copy(f.value)}
                      className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded hover:bg-white/10"
                      title="Copy"
                    >
                      {copied === f.value ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function bucketFor(f: Finding): string {
  if (f.source.startsWith("dns:")) return "DNS";
  if (f.source.startsWith("rdap:")) return "WHOIS / RDAP";
  if (f.source.startsWith("ct-logs:")) return "Certificate Transparency";
  return "Other";
}

function iconFor(bucket: string) {
  switch (bucket) {
    case "DNS":
      return <Network className="w-4 h-4" />;
    case "WHOIS / RDAP":
      return <Fingerprint className="w-4 h-4" />;
    case "Certificate Transparency":
      return <Shield className="w-4 h-4" />;
    default:
      return <Globe className="w-4 h-4" />;
  }
}

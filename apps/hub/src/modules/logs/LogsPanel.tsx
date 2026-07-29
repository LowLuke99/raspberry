import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, X, AlertOctagon, AlertTriangle, Info, Zap } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { target, type LogEvent } from "@/target";

const LOGS = ["System", "Application", "Security"] as const;
type LogName = (typeof LOGS)[number];

const LEVEL_ORDER = ["Critical", "Error", "Warning", "Information", "Verbose"];

/**
 * Windows Event Log viewer — pulls the last N events from a selected log via
 * Get-WinEvent. Level filtering + search on the client. Security log needs
 * admin; when the backend returns nothing, the empty state says so.
 */
export function LogsPanel({ manifest }: { manifest: ModuleManifest }) {
  const [log, setLog] = useState<LogName>("System");
  const [max, setMax] = useState(50);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setExpanded(null);
    target
      .logsRead(log, max)
      .then((es) => alive && setEvents(es))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [log, max, tick]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) map[e.level] = (map[e.level] ?? 0) + 1;
    return map;
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (levelFilter.size > 0 && !levelFilter.has(e.level)) return false;
      if (!q) return true;
      return (
        e.message.toLowerCase().includes(q) ||
        e.provider.toLowerCase().includes(q) ||
        String(e.id).includes(q)
      );
    });
  }, [events, query, levelFilter]);

  const toggleLevel = (lvl: string) =>
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-2">
          <div className="mono rounded-full bg-surface px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-text-dim shadow-[var(--hairline)]">
            {filtered.length} / {events.length}
          </div>
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="focus-ring flex items-center gap-1.5 rounded-[9px] bg-surface-hi px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:text-raspberry"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3">
        {/* log picker + count picker */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)]">
            {LOGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLog(l)}
                className={cn(
                  "rounded-[7px] px-2.5 py-1 text-[11px] transition-colors",
                  log === l ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)]">
            {[50, 100, 200, 500].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMax(n)}
                className={cn(
                  "rounded-[7px] px-2 py-1 text-[11px] transition-colors",
                  max === n ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {LEVEL_ORDER.map((lvl) => (
              <LevelChip
                key={lvl}
                level={lvl}
                count={counts[lvl] ?? 0}
                active={levelFilter.has(lvl)}
                onClick={() => toggleLevel(lvl)}
              />
            ))}
          </div>
        </div>

        {/* search */}
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, providers, event IDs…"
            className="focus-ring h-9 w-full rounded-[10px] bg-[rgba(0,0,0,0.25)] pl-8 pr-9 text-[12.5px] text-text placeholder:text-text-dim shadow-[var(--hairline)]"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-dim hover:text-text"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading && events.length === 0 ? (
            <GlassPanel interactive={false} className="p-6 text-center text-[12.5px] text-text-dim">
              Loading events…
            </GlassPanel>
          ) : filtered.length === 0 ? (
            <GlassPanel interactive={false} className="p-6 text-center text-[12.5px] text-text-dim">
              {events.length === 0
                ? `No events in ${log}. (${log === "Security" ? "Security log needs admin." : ""})`
                : "No events match your filters."}
            </GlassPanel>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((e, i) => (
                <EventRow
                  key={`${e.time}-${e.id}-${i}`}
                  ev={e}
                  expanded={expanded === i}
                  onToggle={() => setExpanded((prev) => (prev === i ? null : i))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function EventRow({
  ev,
  expanded,
  onToggle,
}: {
  ev: LogEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <GlassPanel interactive={false} className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[24px_100px_1fr_60px] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-hi/40"
      >
        <LevelIcon level={ev.level} />
        <span className="mono truncate text-[11px] text-text-dim">
          {formatWhen(ev.time)}
        </span>
        <span className="min-w-0">
          <span className="truncate text-[12.5px] text-text">{ev.provider}</span>
          <div className="truncate text-[11.5px] text-text-dim">{ev.message || "(no message)"}</div>
        </span>
        <span className="mono text-right text-[11px] text-text-dim">#{ev.id}</span>
      </button>
      {expanded && (
        <div className="border-t border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-[12.5px]">
          <div className="mono mb-1 text-[10px] uppercase tracking-wider text-text-dim">
            {ev.log} · {ev.level} · {new Date(ev.time).toLocaleString()}
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-text">
            {ev.message || "(no message body)"}
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

function LevelChip({
  level,
  count,
  active,
  onClick,
}: {
  level: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-wider transition-colors",
        active ? "bg-surface-hi text-text shadow-[var(--hairline)]" : "bg-surface text-text-dim hover:text-text",
      )}
    >
      <LevelDot level={level} />
      {level}
      <span className="mono opacity-70">{count}</span>
    </button>
  );
}

function LevelIcon({ level }: { level: string }) {
  const c = colorFor(level);
  const icon = iconFor(level);
  return (
    <span className="grid h-6 w-6 place-items-center rounded-[6px]" style={{ background: c.bg, color: c.fg }}>
      {icon}
    </span>
  );
}

function LevelDot({ level }: { level: string }) {
  const c = colorFor(level);
  return <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />;
}

function iconFor(level: string) {
  if (level === "Critical") return <Zap size={12} />;
  if (level === "Error") return <AlertOctagon size={12} />;
  if (level === "Warning") return <AlertTriangle size={12} />;
  return <Info size={12} />;
}

function colorFor(level: string): { fg: string; bg: string } {
  if (level === "Critical") return { fg: "rgb(225,29,72)", bg: "rgba(225,29,72,0.20)" };
  if (level === "Error") return { fg: "rgb(251,44,80)", bg: "rgba(251,44,80,0.14)" };
  if (level === "Warning") return { fg: "rgb(251,191,36)", bg: "rgba(251,191,36,0.14)" };
  if (level === "Verbose") return { fg: "rgb(148,163,184)", bg: "rgba(148,163,184,0.10)" };
  return { fg: "rgb(56,189,248)", bg: "rgba(56,189,248,0.12)" };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

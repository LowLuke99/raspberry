import { useMemo, useState, useEffect } from "react";
import {
  Copy,
  Check,
  Search,
  ShieldAlert,
  ChevronDown,
  Star,
  Terminal,
  Play,
  X,
  AlertTriangle,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { bus } from "@/lib/bus";
import { isTauri } from "@/target";
import {
  TWEAKS,
  TWEAK_CATEGORY_LABEL,
  type TweakCategory,
  type Tweak,
} from "./catalog";

const FAV_KEY = "raspberry.tweaks.favorites";
const CATS = Object.keys(TWEAK_CATEGORY_LABEL) as TweakCategory[];

type Filter = TweakCategory | "all" | "fav";

/**
 * Tweaks — a curated subset of ChrisTitusTech/winutil's most-useful commands
 * (installs, debloat, privacy, perf, fixes, UI). Same discipline as the
 * Commands module: nothing runs unattended. Click a card to copy; the Run
 * button pastes into the built-in Terminal without pressing Enter for you.
 */
export function TweaksPanel({ manifest }: { manifest: ModuleManifest }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TWEAKS.filter((t) => {
      if (activeCat === "fav") {
        if (!favorites.has(t.id)) return false;
      } else if (activeCat !== "all" && t.category !== activeCat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.command.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.tags ?? []).some((tag) => tag.includes(q))
      );
    });
  }, [query, activeCat, favorites]);

  const copy = (t: Tweak) => {
    navigator.clipboard.writeText(t.command).then(() => {
      setCopiedId(t.id);
      setTimeout(() => setCopiedId((prev) => (prev === t.id ? null : prev)), 1200);
    });
  };

  const runInTerminal = (t: Tweak) => {
    bus.emit("nav:go", { moduleId: "terminal" });
    setTimeout(() => bus.emit("terminal:run", { command: t.command }), 120);
  };

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: TWEAKS.length,
      fav: favorites.size,
      install: 0,
      debloat: 0,
      privacy: 0,
      performance: 0,
      fix: 0,
      ui: 0,
    };
    for (const t of TWEAKS) map[t.category] += 1;
    return map;
  }, [favorites]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="mono rounded-full bg-surface px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-text-dim shadow-[var(--hairline)]">
          {filtered.length} / {TWEAKS.length}
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3">
        {/* legal-ish warning */}
        <GlassPanel
          interactive={false}
          className="flex items-center gap-3 border-l-2 border-l-raspberry/60 px-3 py-2"
        >
          <AlertTriangle size={14} className="shrink-0 text-raspberry" />
          <p className="text-[11.5px] leading-relaxed text-text-dim">
            Every tweak is <span className="text-text">read-only from Raspberry's side</span>.
            Nothing runs until you copy it or click Run — which pastes into the built-in
            Terminal without pressing Enter for you.
          </p>
        </GlassPanel>

        {/* search */}
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tweaks…"
            className="focus-ring h-9 w-full rounded-[10px] bg-[rgba(0,0,0,0.25)] pl-8 pr-9 text-[13px] text-text placeholder:text-text-dim shadow-[var(--hairline)]"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-dim hover:text-text"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* categories */}
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          <Chip label="All" count={counts.all} active={activeCat === "all"} onClick={() => setActiveCat("all")} />
          <Chip
            label="Favorites"
            count={counts.fav}
            active={activeCat === "fav"}
            onClick={() => setActiveCat("fav")}
            icon={<Star size={11} strokeWidth={2} fill={activeCat === "fav" ? "currentColor" : "none"} />}
            accent
          />
          <div className="mx-1 w-px shrink-0 self-stretch bg-[rgba(255,255,255,0.06)]" />
          {CATS.map((k) => (
            <Chip
              key={k}
              label={TWEAK_CATEGORY_LABEL[k]}
              count={counts[k]}
              active={activeCat === k}
              onClick={() => setActiveCat(k)}
            />
          ))}
        </div>

        {/* list */}
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2.5 overflow-y-auto pr-1 2xl:grid-cols-2">
          {filtered.map((t) => (
            <TweakCard
              key={t.id}
              tweak={t}
              expanded={expanded === t.id}
              copied={copiedId === t.id}
              starred={favorites.has(t.id)}
              canRun={isTauri()}
              onCopy={() => copy(t)}
              onRun={() => runInTerminal(t)}
              onToggleExpand={() => setExpanded((prev) => (prev === t.id ? null : t.id))}
              onToggleFav={() => toggleFav(t.id)}
            />
          ))}
          {filtered.length === 0 && (
            <GlassPanel
              interactive={false}
              className="col-span-full grid place-items-center p-10 text-center text-[13px] text-text-dim"
            >
              No tweaks match{query ? ` "${query}"` : ""}.
            </GlassPanel>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function TweakCard({
  tweak,
  expanded,
  copied,
  starred,
  canRun,
  onCopy,
  onRun,
  onToggleExpand,
  onToggleFav,
}: {
  tweak: Tweak;
  expanded: boolean;
  copied: boolean;
  starred: boolean;
  canRun: boolean;
  onCopy: () => void;
  onRun: () => void;
  onToggleExpand: () => void;
  onToggleFav: () => void;
}) {
  return (
    <GlassPanel
      interactive={false}
      className={cn(
        "flex flex-col overflow-hidden transition-shadow",
        copied &&
          "shadow-[inset_0_0_0_1px_rgba(225,29,72,0.45),0_0_20px_rgba(225,29,72,0.25)]",
      )}
    >
      <div className="flex flex-col gap-2 px-4 pb-2 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13.5px] font-medium leading-snug text-text">
                {tweak.name}
              </span>
              <ShellBadge shell={tweak.shell} />
              {tweak.admin && (
                <span
                  className="mono flex items-center gap-1 rounded-full bg-[rgba(225,29,72,0.14)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-raspberry"
                  title="Requires an elevated (Run as administrator) shell"
                >
                  <ShieldAlert size={9} strokeWidth={2.2} /> admin
                </span>
              )}
              {tweak.danger && <DangerBadge level={tweak.danger} />}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleFav}
            className={cn(
              "focus-ring mt-0.5 shrink-0 rounded p-1 transition-colors",
              starred ? "text-raspberry" : "text-text-dim hover:text-text",
            )}
            aria-label={starred ? "Unstar" : "Star"}
            title={starred ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star size={14} fill={starred ? "currentColor" : "none"} strokeWidth={1.75} />
          </button>
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="focus-ring group flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2.5 py-1.5 text-left shadow-[var(--hairline)] transition-colors hover:bg-[rgba(0,0,0,0.36)]"
          title="Click to copy"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-surface-hi text-text-dim transition-colors group-hover:text-raspberry">
            {copied ? <Check size={12} className="text-raspberry" /> : <Copy size={12} />}
          </span>
          <span className="mono min-w-0 flex-1 whitespace-pre-wrap break-all text-[11.5px] leading-relaxed text-text-dim group-hover:text-text">
            {tweak.command}
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.04)] px-3 py-1.5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="focus-ring flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-text-dim transition-colors hover:text-text"
          aria-expanded={expanded}
        >
          <ChevronDown
            size={12}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
          {expanded ? "Hide info" : "What does this do?"}
        </button>
        {canRun && (
          <button
            type="button"
            onClick={onRun}
            className="focus-ring flex items-center gap-1 rounded bg-surface-hi px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-text-dim transition-colors hover:text-raspberry"
            title="Send to the built-in Terminal (does not auto-press Enter)"
          >
            <Play size={10} strokeWidth={2} /> run
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.18)] px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-text">{tweak.description}</p>
          {tweak.tags && tweak.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tweak.tags.map((t) => (
                <span
                  key={t}
                  className="mono rounded-full bg-surface-hi px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-text-dim"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
  icon,
  accent,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] transition-colors",
        active
          ? "bg-surface-hi text-text shadow-[var(--hairline)]"
          : "bg-surface text-text-dim hover:text-text",
        accent && !active && "text-raspberry/70",
      )}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      <span>{label}</span>
      <span className="mono text-[9.5px] uppercase tracking-wider opacity-70">{count}</span>
    </button>
  );
}

function DangerBadge({ level }: { level: "low" | "medium" | "high" }) {
  const label = level === "high" ? "risky" : level === "medium" ? "care" : "safe";
  const tint =
    level === "high"
      ? "rgba(251,44,80,0.18)"
      : level === "medium"
        ? "rgba(251,191,36,0.16)"
        : "rgba(148,163,184,0.14)";
  return (
    <span
      className="mono rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text"
      style={{ background: tint }}
      title={`Risk level: ${level}`}
    >
      {label}
    </span>
  );
}

function ShellBadge({ shell }: { shell: Tweak["shell"] }) {
  const map: Record<Tweak["shell"], { label: string; tint: string }> = {
    cmd: { label: "cmd", tint: "rgba(139,92,246,0.16)" },
    ps: { label: "ps", tint: "rgba(56,189,248,0.16)" },
    either: { label: "any", tint: "rgba(148,163,184,0.16)" },
  };
  const meta = map[shell];
  return (
    <span
      className="mono flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text"
      style={{ background: meta.tint }}
    >
      <Terminal size={9} strokeWidth={2} />
      {meta.label}
    </span>
  );
}

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

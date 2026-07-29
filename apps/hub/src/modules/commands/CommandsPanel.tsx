import { useMemo, useState, useEffect, useRef } from "react";
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
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { bus } from "@/lib/bus";
import { isTauri } from "@/target";
import {
  COMMANDS,
  CATEGORY_LABEL,
  type CommandCategory,
  type WinCommand,
} from "./catalog";

const FAV_STORAGE_KEY = "raspberry.commands.favorites";
const RECENT_STORAGE_KEY = "raspberry.commands.recent";
const RECENT_MAX = 6;
const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL) as CommandCategory[];

type ActiveFilter = CommandCategory | "all" | "fav" | "recent";

/**
 * Windows Commands — a searchable, copy-on-click library of useful CLI/PS
 * commands. Everything is client-side (no shell exec) so the security surface
 * stays zero. Redesigned for readability at any panel width: cards breathe,
 * names wrap to two lines, and the category rail scrolls horizontally instead
 * of wrapping into a wall of pills.
 */
export function CommandsPanel({ manifest }: { manifest: ModuleManifest }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ActiveFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent));
  }, [recent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (activeCat === "recent" && !q) {
      const byId = new Map(COMMANDS.map((c) => [c.id, c]));
      return recent.map((id) => byId.get(id)).filter((c): c is WinCommand => !!c);
    }

    return COMMANDS.filter((c) => {
      if (activeCat === "fav") {
        if (!favorites.has(c.id)) return false;
      } else if (activeCat === "recent") {
        if (!recent.includes(c.id)) return false;
      } else if (activeCat !== "all" && c.category !== activeCat) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.command.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.includes(q))
      );
    });
  }, [query, activeCat, favorites, recent]);

  const pushRecent = (id: string) => {
    setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX));
  };

  const copy = (c: WinCommand) => {
    navigator.clipboard.writeText(c.command).then(() => {
      setCopiedId(c.id);
      pushRecent(c.id);
      setTimeout(() => setCopiedId((prev) => (prev === c.id ? null : prev)), 1200);
    });
  };

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runInTerminal = (c: WinCommand) => {
    pushRecent(c.id);
    bus.emit("nav:go", { moduleId: "terminal" });
    // give the panel a beat to mount before we shove text into the PTY
    setTimeout(() => bus.emit("terminal:run", { command: c.command }), 120);
  };

  const counts = useMemo(() => {
    const map: Record<ActiveFilter, number> = {
      all: COMMANDS.length,
      fav: favorites.size,
      recent: recent.length,
      system: 0,
      network: 0,
      process: 0,
      storage: 0,
      admin: 0,
      power: 0,
      shortcuts: 0,
      nerd: 0,
    };
    for (const c of COMMANDS) map[c.category] += 1;
    return map;
  }, [favorites, recent.length]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="mono rounded-full bg-surface px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-text-dim shadow-[var(--hairline)]">
          {filtered.length} / {COMMANDS.length}
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3">
        {/* search */}
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, tags, descriptions…"
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

        {/* categories — horizontal scroll rail with arrow nudges */}
        <CategoryRail
          activeCat={activeCat}
          counts={counts}
          onSelect={setActiveCat}
        />

        {/* list */}
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2.5 overflow-y-auto pr-1 2xl:grid-cols-2">
          {filtered.map((c) => (
            <CommandCard
              key={c.id}
              cmd={c}
              expanded={expanded === c.id}
              copied={copiedId === c.id}
              starred={favorites.has(c.id)}
              canRun={isTauri()}
              onCopy={() => copy(c)}
              onRun={() => runInTerminal(c)}
              onToggleExpand={() =>
                setExpanded((prev) => (prev === c.id ? null : c.id))
              }
              onToggleFav={() => toggleFav(c.id)}
            />
          ))}
          {filtered.length === 0 && (
            <GlassPanel
              interactive={false}
              className="col-span-full grid place-items-center p-10 text-center text-[13px] text-text-dim"
            >
              {activeCat === "recent"
                ? "No recently used commands yet — copy or run one to see it here."
                : `No commands match${query ? ` "${query}"` : ""}.`}
            </GlassPanel>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

/* ── category rail ───────────────────────────────────────────────── */

function CategoryRail({
  activeCat,
  counts,
  onSelect,
}: {
  activeCat: ActiveFilter;
  counts: Record<ActiveFilter, number>;
  onSelect: (c: ActiveFilter) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const refreshArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    refreshArrows();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => refreshArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(refreshArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const nudge = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.7, 260), behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canLeft && (
        <>
          <button
            type="button"
            onClick={() => nudge(-1)}
            className="absolute left-0 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-surface-hi text-text-dim shadow-[var(--hairline)] hover:text-text"
            aria-label="Scroll categories left"
          >
            <ChevronLeft size={13} />
          </button>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-10 bg-gradient-to-r from-[rgba(0,0,0,0.5)] to-transparent" />
        </>
      )}
      {canRight && (
        <>
          <button
            type="button"
            onClick={() => nudge(1)}
            className="absolute right-0 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-surface-hi text-text-dim shadow-[var(--hairline)] hover:text-text"
            aria-label="Scroll categories right"
          >
            <ChevronRight size={13} />
          </button>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-10 bg-gradient-to-l from-[rgba(0,0,0,0.5)] to-transparent" />
        </>
      )}

      <div
        ref={scrollRef}
        className="scrollbar-none flex gap-1.5 overflow-x-auto scroll-smooth px-1"
        style={{ scrollbarWidth: "none" }}
      >
        <CategoryChip
          label="All"
          count={counts.all}
          active={activeCat === "all"}
          onClick={() => onSelect("all")}
        />
        <CategoryChip
          label="Recent"
          icon={<History size={11} strokeWidth={2} />}
          count={counts.recent}
          active={activeCat === "recent"}
          onClick={() => onSelect("recent")}
          dimIfEmpty
        />
        <CategoryChip
          label="Favorites"
          icon={<Star size={11} strokeWidth={2} fill={activeCat === "fav" ? "currentColor" : "none"} />}
          count={counts.fav}
          active={activeCat === "fav"}
          onClick={() => onSelect("fav")}
          accent
        />
        <div className="mx-1 w-px shrink-0 self-stretch bg-[rgba(255,255,255,0.06)]" />
        {CATEGORY_KEYS.map((k) => (
          <CategoryChip
            key={k}
            label={CATEGORY_LABEL[k]}
            count={counts[k]}
            active={activeCat === k}
            onClick={() => onSelect(k)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── card ────────────────────────────────────────────────────────── */

function CommandCard({
  cmd,
  expanded,
  copied,
  starred,
  canRun,
  onCopy,
  onRun,
  onToggleExpand,
  onToggleFav,
}: {
  cmd: WinCommand;
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
        copied && "shadow-[inset_0_0_0_1px_rgba(225,29,72,0.45),0_0_20px_rgba(225,29,72,0.25)]",
      )}
    >
      {/* body — name/badges + command line, plenty of room */}
      <div className="flex flex-col gap-2 px-4 pb-2 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13.5px] font-medium leading-snug text-text">
                {cmd.name}
              </span>
              <ShellBadge shell={cmd.shell} />
              {cmd.admin && (
                <span
                  className="mono flex items-center gap-1 rounded-full bg-[rgba(225,29,72,0.14)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-raspberry"
                  title="Requires an elevated (Run as administrator) shell"
                >
                  <ShieldAlert size={9} strokeWidth={2.2} /> admin
                </span>
              )}
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

        {/* command mono strip — its own line, wraps if it must */}
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
            {cmd.command}
          </span>
        </button>
      </div>

      {/* footer row: expand + run */}
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
          <p className="text-[12.5px] leading-relaxed text-text">{cmd.description}</p>
          {cmd.tags && cmd.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {cmd.tags.map((t) => (
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

/* ── little UI bits ──────────────────────────────────────────────── */

function CategoryChip({
  label,
  count,
  active,
  onClick,
  accent,
  icon,
  dimIfEmpty,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
  icon?: React.ReactNode;
  dimIfEmpty?: boolean;
}) {
  const empty = dimIfEmpty && count === 0 && !active;
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
        empty && "opacity-60",
      )}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      <span>{label}</span>
      <span className="mono text-[9.5px] uppercase tracking-wider opacity-70">{count}</span>
    </button>
  );
}

function ShellBadge({ shell }: { shell: WinCommand["shell"] }) {
  const map: Record<WinCommand["shell"], { label: string; tint: string }> = {
    cmd: { label: "cmd", tint: "rgba(139,92,246,0.16)" },
    ps: { label: "ps", tint: "rgba(56,189,248,0.16)" },
    either: { label: "any", tint: "rgba(148,163,184,0.16)" },
  };
  const meta = map[shell];
  return (
    <span
      className="mono flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text"
      style={{ background: meta.tint }}
      title={
        shell === "cmd"
          ? "Best run in Command Prompt (cmd)"
          : shell === "ps"
            ? "Best run in PowerShell"
            : "Works in either shell"
      }
    >
      <Terminal size={9} strokeWidth={2} />
      {meta.label}
    </span>
  );
}

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

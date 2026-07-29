import { useMemo, useState, useEffect } from "react";
import {
  Copy,
  Check,
  Search,
  ShieldAlert,
  ChevronDown,
  Star,
  Terminal,
  X,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import {
  COMMANDS,
  CATEGORY_LABEL,
  type CommandCategory,
  type WinCommand,
} from "./catalog";

const FAV_STORAGE_KEY = "raspberry.commands.favorites";
const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL) as CommandCategory[];

/**
 * Windows Commands — a searchable, copy-on-click library of useful CLI/PS
 * commands. Everything is client-side (no shell exec) so the security surface
 * stays zero: click a card → clipboard; click chevron → short human-language
 * description of what the command actually does.
 */
export function CommandsPanel({ manifest }: { manifest: ModuleManifest }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<CommandCategory | "all" | "fav">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMANDS.filter((c) => {
      if (activeCat === "fav") {
        if (!favorites.has(c.id)) return false;
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
  }, [query, activeCat, favorites]);

  const copy = (c: WinCommand) => {
    navigator.clipboard.writeText(c.command).then(() => {
      setCopiedId(c.id);
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

  const counts = useMemo(() => {
    const map: Record<CommandCategory | "all" | "fav", number> = {
      all: COMMANDS.length,
      fav: favorites.size,
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
  }, [favorites]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="mono rounded-full bg-surface px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-text-dim shadow-[var(--hairline)]">
          {filtered.length} / {COMMANDS.length}
        </div>
      }
    >
      <div className="flex h-full flex-col gap-4">
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

        {/* categories */}
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            label="All"
            count={counts.all}
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
          />
          <CategoryChip
            label="★ Favorites"
            count={counts.fav}
            active={activeCat === "fav"}
            onClick={() => setActiveCat("fav")}
            accent
          />
          {CATEGORY_KEYS.map((k) => (
            <CategoryChip
              key={k}
              label={CATEGORY_LABEL[k]}
              count={counts[k]}
              active={activeCat === k}
              onClick={() => setActiveCat(k)}
            />
          ))}
        </div>

        {/* list */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 xl:grid-cols-2">
          {filtered.map((c) => (
            <CommandCard
              key={c.id}
              cmd={c}
              expanded={expanded === c.id}
              copied={copiedId === c.id}
              starred={favorites.has(c.id)}
              onCopy={() => copy(c)}
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
              No commands match{query ? ` "${query}"` : ""}.
            </GlassPanel>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

/* ── card ────────────────────────────────────────────────────────── */

function CommandCard({
  cmd,
  expanded,
  copied,
  starred,
  onCopy,
  onToggleExpand,
  onToggleFav,
}: {
  cmd: WinCommand;
  expanded: boolean;
  copied: boolean;
  starred: boolean;
  onCopy: () => void;
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
      {/* header row: click anywhere here to copy */}
      <button
        type="button"
        onClick={onCopy}
        className="group flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hi/40"
      >
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-surface-hi text-text-dim shadow-[var(--hairline)] group-hover:text-raspberry">
          {copied ? <Check size={14} className="text-raspberry" /> : <Copy size={14} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-text">{cmd.name}</span>
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
          <div className="mono mt-1 truncate text-[12px] text-text-dim">{cmd.command}</div>
        </div>
        <span className="mt-1 mono shrink-0 text-[10px] uppercase tracking-wider text-text-dim opacity-0 transition-opacity group-hover:opacity-100">
          {copied ? "copied" : "click to copy"}
        </span>
      </button>

      {/* footer row: expand + star */}
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
        <button
          type="button"
          onClick={onToggleFav}
          className={cn(
            "focus-ring rounded p-1 transition-colors",
            starred ? "text-raspberry" : "text-text-dim hover:text-text",
          )}
          aria-label={starred ? "Unstar" : "Star"}
          title={starred ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Star size={13} fill={starred ? "currentColor" : "none"} strokeWidth={1.75} />
        </button>
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
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "bg-surface-hi text-text shadow-[var(--hairline)]"
          : "bg-surface text-text-dim hover:text-text",
        accent && !active && "text-raspberry/70",
      )}
    >
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

import { useMemo, useState } from "react";
import { Search, X, Keyboard as KeyboardIcon } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { HOTKEYS, HOTKEY_GROUP_LABEL, type HotkeyGroup, type Hotkey } from "./catalog";

type Filter = HotkeyGroup | "all";

/**
 * Hotkeys — a searchable catalog of Windows, Explorer, browser, VS Code,
 * Terminal, PowerToys, and general text-editing keyboard shortcuts.
 *
 * Same discipline as Commands / Tweaks: data-driven, purely local, no side
 * effects — this is a learning surface, not an executor.
 */
export function HotkeysPanel({ manifest }: { manifest: ModuleManifest }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Filter>("all");

  const groups = HOTKEYS.map((s) => s.group);
  const totalCount = useMemo(
    () => HOTKEYS.reduce((n, s) => n + s.items.length, 0),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sections = group === "all" ? HOTKEYS : HOTKEYS.filter((s) => s.group === group);
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (h) =>
            h.what.toLowerCase().includes(q) ||
            h.keys.toLowerCase().includes(q) ||
            (h.detail?.toLowerCase().includes(q) ?? false) ||
            (h.tags?.some((t) => t.toLowerCase().includes(q)) ?? false),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, group]);

  const shownCount = useMemo(
    () => filtered.reduce((n, s) => n + s.items.length, 0),
    [filtered],
  );

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="mono rounded-full bg-surface px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-text-dim shadow-[var(--hairline)]">
          {shownCount} / {totalCount}
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shortcuts — try 'clipboard', 'screenshot', 'Ctrl+K'…"
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

        <div
          className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: "none" }}
        >
          <Chip label="All" active={group === "all"} onClick={() => setGroup("all")} />
          <div className="mx-1 w-px shrink-0 self-stretch bg-[rgba(255,255,255,0.06)]" />
          {groups.map((g) => (
            <Chip
              key={g}
              label={HOTKEY_GROUP_LABEL[g]}
              active={group === g}
              onClick={() => setGroup(g)}
            />
          ))}
        </div>

        <div className="grid min-h-0 flex-1 auto-rows-min gap-4 overflow-y-auto pr-1">
          {filtered.map((s) => (
            <section key={s.group} className="flex flex-col gap-2">
              <header className="flex items-center gap-2">
                <span className="text-[13px] font-semibold tracking-tight text-text">
                  {s.title}
                </span>
                <span className="mono rounded-full bg-surface px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-text-dim">
                  {s.items.length}
                </span>
              </header>
              <p className="-mt-1 text-[11.5px] leading-relaxed text-text-dim">
                {s.subtitle}
              </p>
              <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                {s.items.map((h, i) => (
                  <HotkeyRow key={`${s.group}-${i}`} hotkey={h} />
                ))}
              </div>
            </section>
          ))}
          {filtered.length === 0 && (
            <GlassPanel
              interactive={false}
              className="grid place-items-center p-10 text-center text-[13px] text-text-dim"
            >
              <div className="flex flex-col items-center gap-2">
                <KeyboardIcon size={18} className="text-text-dim/70" />
                <span>No shortcuts match{query ? ` "${query}"` : ""}.</span>
              </div>
            </GlassPanel>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function HotkeyRow({ hotkey }: { hotkey: Hotkey }) {
  return (
    <GlassPanel
      interactive={false}
      className="flex items-start gap-3 px-3 py-2"
    >
      <KeysBlock keys={hotkey.keys} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[12.5px] leading-snug text-text">{hotkey.what}</div>
        {hotkey.detail && (
          <div className="mt-0.5 text-[11px] leading-snug text-text-dim">
            {hotkey.detail}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

/**
 * Renders the key string as individual keycap pills. Splits on `+` for
 * simultaneous keys and on `,` for two-step chords, so `Ctrl+K, Ctrl+S`
 * renders as [Ctrl][+][K], then [Ctrl][+][S] visually separated.
 */
function KeysBlock({ keys }: { keys: string }) {
  const chords = keys.split(",").map((c) => c.trim());
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 pt-0.5">
      {chords.map((chord, ci) => (
        <span key={ci} className="flex flex-wrap items-center gap-1">
          {chord.split("+").map((k, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              <Keycap>{k}</Keycap>
              {i < arr.length - 1 && (
                <span className="text-[10px] text-text-dim">+</span>
              )}
            </span>
          ))}
          {ci < chords.length - 1 && (
            <span className="mx-0.5 text-[10px] text-text-dim">then</span>
          )}
        </span>
      ))}
    </div>
  );
}

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mono inline-flex min-w-[22px] items-center justify-center rounded-[6px] bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[10.5px] font-medium text-text shadow-[inset_0_-1px_0_rgba(0,0,0,0.35),var(--hairline)]">
      {children}
    </kbd>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
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
      )}
    >
      <span>{label}</span>
    </button>
  );
}

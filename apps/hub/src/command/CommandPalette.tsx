import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, CornerDownLeft, type LucideIcon } from "lucide-react";
import { registry } from "@/modules/registry";
import { useAppStore } from "@/state/useAppStore";
import { cn } from "@/lib/cn";
import { matchCommands, type Command } from "./matchCommands";

/** A runnable palette entry (extends the matchable Command shape). */
interface PaletteCommand extends Command {
  run: () => void;
  icon: LucideIcon;
}

/**
 * Command palette (spec §6/§8). Ctrl+K opens a centered glass overlay with a
 * filtered command list. Phase 1 commands = "Go to <module>" for every
 * registered route; Phase 2+ modules contribute their own via manifests.
 */
export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the command list from the registry (recomputed only if modules change).
  const commands = useMemo<PaletteCommand[]>(
    () =>
      registry.all().map((m) => ({
        id: m.id,
        label: m.label,
        hint: "Go to module",
        ...(m.keywords ? { keywords: m.keywords } : {}),
        icon: m.icon,
        run: () => setActiveRoute(m.route),
      })),
    [setActiveRoute],
  );

  const results = useMemo(
    () => matchCommands(query, commands),
    [query, commands],
  );

  // Reset + focus each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // focus after the enter animation begins
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep the selection in range as results shrink.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);

  function runAt(index: number) {
    const cmd = results[index];
    if (!cmd) return;
    cmd.run();
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (s + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (s - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(selected);
    }
  }

  // Conditional mount rather than AnimatePresence: closing unmounts the overlay
  // instantly, so a dropped exit-complete (StrictMode dev) can never strand an
  // invisible layer over the app. The enter animation still plays on open.
  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
          transition={{ duration: 0.14 }}
          onMouseDown={() => setOpen(false)}
        >
          {/* scrim */}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />

          {/* panel */}
          <motion.div
            className="glass relative z-10 w-[min(92vw,560px)] overflow-hidden"
            style={{ background: "var(--surface-hi)" }}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            {/* search row */}
            <div className="flex items-center gap-3 border-b border-stroke px-4 py-3.5">
              <Search size={17} className="text-text-dim" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a module…"
                className="flex-1 bg-transparent text-[14px] text-text placeholder:text-text-dim focus:outline-none"
                spellCheck={false}
                autoComplete="off"
              />
              <kbd className="mono rounded-[6px] bg-surface px-1.5 py-0.5 text-[10px] text-text-dim shadow-[var(--hairline)]">
                Esc
              </kbd>
            </div>

            {/* results */}
            <ul className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-[13px] text-text-dim">
                  No commands match “{query}”.
                </li>
              )}
              {results.map((cmd, i) => {
                const Icon = cmd.icon;
                const isSel = i === selected;
                return (
                  <li key={cmd.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setSelected(i)}
                      onClick={() => runAt(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
                        isSel ? "bg-[rgba(var(--raspberry-rgb),0.16)]" : "hover:bg-surface",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-[8px]",
                          isSel ? "text-raspberry" : "text-text-dim",
                        )}
                      >
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[13px] font-medium text-text">
                          {cmd.label}
                        </span>
                        {cmd.hint && (
                          <span className="block text-[11px] text-text-dim">
                            {cmd.hint}
                          </span>
                        )}
                      </span>
                      {isSel && (
                        <CornerDownLeft size={14} className="text-text-dim" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
  );
}

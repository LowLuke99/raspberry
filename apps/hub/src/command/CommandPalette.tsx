import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, CornerDownLeft, Copy, Check, type LucideIcon } from "lucide-react";
import { registry } from "@/modules/registry";
import { useAppStore } from "@/state/useAppStore";
import { useAgents, LOCAL_ID } from "@/state/useAgents";
import { cn } from "@/lib/cn";
import { matchCommands, type Command } from "./matchCommands";
import { COMMANDS as WIN_COMMANDS } from "@/modules/commands/catalog";
import { BookText, ShieldAlert, Monitor, Radio } from "lucide-react";

/** A runnable palette entry (extends the matchable Command shape). */
interface PaletteCommand extends Command {
  run: () => void;
  icon: LucideIcon;
  /** "jump" = navigate to a module. "copy" = copy a Windows command to clipboard. */
  kind: "jump" | "copy";
  /** Only present on kind=copy — the raw command text. Rendered as monospace. */
  mono?: string;
  admin?: boolean;
}

/**
 * Command palette (spec §6/§8). Ctrl+K opens a centered glass overlay with a
 * filtered command list.
 *
 * Two kinds of entries live together:
 *   - Module jumps  (kind: "jump") — always present.
 *   - Windows commands (kind: "copy") — only surface when the user has typed a
 *     query, so the empty state stays a clean module list. Pressing Enter on a
 *     copy entry writes the command to the clipboard.
 */
export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const agents = useAgents((s) => s.agents);
  const activeAgentId = useAgents((s) => s.activeId);
  const setActiveAgent = useAgents((s) => s.setActive);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const moduleCommands = useMemo<PaletteCommand[]>(
    () =>
      registry.all().map((m) => ({
        id: `mod:${m.id}`,
        label: m.label,
        hint: m.description ?? "Go to module",
        ...(m.keywords ? { keywords: m.keywords } : {}),
        icon: m.icon,
        kind: "jump",
        run: () => setActiveRoute(m.route),
      })),
    [setActiveRoute],
  );

  const machineCommands = useMemo<PaletteCommand[]>(() => {
    const entries: PaletteCommand[] = [
      {
        id: `machine:${LOCAL_ID}`,
        label: "Switch to: This PC",
        hint: activeAgentId === LOCAL_ID ? "active target" : "local target",
        keywords: ["machine", "switch", "local", "this pc", "target", "agent"],
        icon: Monitor,
        kind: "jump",
        run: () => setActiveAgent(LOCAL_ID),
      },
    ];
    for (const a of agents) {
      entries.push({
        id: `machine:${a.id}`,
        label: `Switch to: ${a.name}`,
        hint: activeAgentId === a.id ? `active · ${a.baseUrl}` : a.baseUrl,
        keywords: ["machine", "switch", "agent", "remote", a.name, a.baseUrl],
        icon: Radio,
        kind: "jump",
        run: () => setActiveAgent(a.id),
      });
    }
    return entries;
  }, [agents, activeAgentId, setActiveAgent]);

  const winCommands = useMemo<PaletteCommand[]>(
    () =>
      WIN_COMMANDS.map((c) => ({
        id: `win:${c.id}`,
        label: c.name,
        hint: c.description,
        keywords: [...(c.tags ?? []), c.command, c.category, c.shell],
        icon: c.admin ? ShieldAlert : BookText,
        kind: "copy",
        mono: c.command,
        ...(c.admin ? { admin: true } : {}),
        run: () => {
          navigator.clipboard.writeText(c.command).then(() => {
            setCopiedId(c.id);
            setTimeout(
              () => setCopiedId((prev) => (prev === c.id ? null : prev)),
              900,
            );
          });
        },
      })),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [...moduleCommands, ...machineCommands];
    return matchCommands(q, [...moduleCommands, ...machineCommands, ...winCommands]);
  }, [query, moduleCommands, machineCommands, winCommands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setCopiedId(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);

  function runAt(index: number) {
    const cmd = results[index];
    if (!cmd) return;
    cmd.run();
    // Only close on a jump — for a copy, stay open so the user can copy another.
    if (cmd.kind === "jump") setOpen(false);
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
        className="glass relative z-10 w-[min(92vw,620px)] overflow-hidden"
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
            placeholder="Jump to a module, or search Windows commands…"
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
            const wasCopied = copiedId !== null && cmd.id === `win:${copiedId}`;
            const isCopy = cmd.kind === "copy";
            return (
              <li key={cmd.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => runAt(i)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
                    isSel ? "bg-[rgba(var(--raspberry-rgb),0.16)]" : "hover:bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px]",
                      isSel ? "text-raspberry" : "text-text-dim",
                    )}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-text">
                        {cmd.label}
                      </span>
                      {isCopy && (
                        <span
                          className="mono shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-dim"
                          title="Windows command — Enter to copy"
                        >
                          cmd
                        </span>
                      )}
                      {cmd.admin && (
                        <span
                          className="mono shrink-0 rounded-full bg-[rgba(225,29,72,0.14)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-raspberry"
                          title="Requires an elevated shell"
                        >
                          admin
                        </span>
                      )}
                    </span>
                    {isCopy && cmd.mono ? (
                      <span className="mono mt-0.5 block truncate text-[11px] text-text-dim">
                        {cmd.mono}
                      </span>
                    ) : (
                      cmd.hint && (
                        <span className="block truncate text-[11px] text-text-dim">
                          {cmd.hint}
                        </span>
                      )
                    )}
                  </span>
                  {isSel && (
                    <span className="mt-1 flex shrink-0 items-center gap-1 text-text-dim">
                      {isCopy ? (
                        wasCopied ? (
                          <>
                            <Check size={13} className="text-raspberry" />
                            <span className="mono text-[10px] uppercase tracking-wider">
                              copied
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span className="mono text-[10px] uppercase tracking-wider">
                              copy
                            </span>
                          </>
                        )
                      ) : (
                        <CornerDownLeft size={14} />
                      )}
                    </span>
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

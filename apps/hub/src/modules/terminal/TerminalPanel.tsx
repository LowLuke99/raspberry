import { useEffect, useState } from "react";
import { Plus, X, TerminalSquare } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { ModuleManifest } from "@/modules/types";
import { isTauri } from "@/target";
import { cn } from "@/lib/cn";
import { bus } from "@/lib/bus";
import { TerminalView } from "./TerminalView";

interface Tab {
  id: string;
  shell: string;
  title: string;
}

const SHELLS: { key: string; label: string }[] = [
  { key: "powershell", label: "PowerShell" },
  { key: "cmd", label: "CMD" },
  { key: "wsl", label: "WSL" },
];

function newTab(shell: string): Tab {
  const label = SHELLS.find((s) => s.key === shell)?.label ?? shell;
  return { id: crypto.randomUUID(), shell, title: label };
}

/**
 * Built-in terminal (spec §9): tabbed real shells. Sessions stay alive on the
 * backend while you switch tabs (views are kept mounted, just hidden). Splits,
 * multi-cast input, and SSH targets arrive in later phases.
 */
export function TerminalPanel({ manifest }: { manifest: ModuleManifest }) {
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab("powershell")]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0]!.id);
  const [defaultShell, setDefaultShell] = useState("powershell");

  function addTab(shell: string) {
    const tab = newTab(shell);
    setTabs((t) => [...t, tab]);
    setActiveId(tab.id);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId && next.length > 0) setActiveId(next[next.length - 1]!.id);
      return next;
    });
  }

  // Listen for cross-module "run this command" requests (e.g. from Commands).
  // We paste into the active tab (never auto-execute unless the caller asks) —
  // the user still hits Enter, which is the safer default for a copied command.
  useEffect(() => {
    if (!isTauri()) return;
    return bus.on("terminal:run", ({ command, execute }) => {
      const data = execute ? `${command}\r` : command;
      invoke("terminal_write", { id: activeId, data }).catch(() => {});
    });
  }, [activeId]);

  // PTYs only exist in the native app; the browser preview can't spawn a shell.
  if (!isTauri()) {
    return <NativeOnly manifest={manifest} />;
  }

  return (
    <div className="flex h-full w-full flex-col p-3">
      {/* tab bar */}
      <div className="mb-2 flex items-center gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "group flex items-center gap-2 rounded-[9px] px-3 py-1.5 text-[12px] transition-colors",
                tab.id === activeId
                  ? "bg-surface-hi text-text shadow-[var(--hairline)]"
                  : "text-text-dim hover:text-text",
              )}
            >
              <TerminalSquare size={13} className={tab.id === activeId ? "text-raspberry" : ""} />
              <span className="whitespace-nowrap">{tab.title}</span>
              {tabs.length > 1 && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 transition-opacity hover:text-raspberry group-hover:opacity-100"
                >
                  <X size={12} />
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => addTab(defaultShell)}
            aria-label="New terminal"
            className="grid h-7 w-7 place-items-center rounded-[8px] text-text-dim transition-colors hover:bg-surface-hi hover:text-text"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* default-shell picker */}
        <div className="flex items-center gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)]">
          {SHELLS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setDefaultShell(s.key)}
              className={cn(
                "rounded-[7px] px-2 py-1 text-[11px] transition-colors",
                defaultShell === s.key ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* terminal surfaces — all kept mounted so sessions persist */}
      <div className="glass relative min-h-0 flex-1 overflow-hidden p-2">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn("absolute inset-2", tab.id === activeId ? "z-10" : "-z-10 opacity-0")}
          >
            <TerminalView id={tab.id} shell={tab.shell} active={tab.id === activeId} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NativeOnly({ manifest }: { manifest: ModuleManifest }) {
  const Icon = manifest.icon;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-[rgba(var(--raspberry-rgb),0.06)] text-text-dim">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <p className="max-w-[320px] text-[13px] leading-relaxed text-text-dim">
        The terminal spawns a real shell (PowerShell / CMD / WSL), so it runs in
        the native Raspberry app — not this browser preview.
      </p>
      <span className="mono rounded-full bg-[rgba(var(--purple-rgb),0.16)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-text">
        native only
      </span>
    </div>
  );
}

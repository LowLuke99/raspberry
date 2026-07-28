import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { ProcessInfo } from "@/target";
import { usePolling } from "@/hooks/usePolling";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { formatBytes, formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

type SortKey = "cpu" | "mem_bytes" | "name";
const MAX_ROWS = 200;

/** Process Explorer (spec §10.2): searchable, sortable process table with a
 *  guarded kill action. Refreshes every 2s. Works locally now, remotely later. */
export function ProcessExplorerPanel({ manifest }: { manifest: ModuleManifest }) {
  const { data, error } = usePolling(() => target.processList(), 2000);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("cpu");
  const [busyPid, setBusyPid] = useState<number | null>(null);

  const rows = useMemo(() => {
    const list = (data ?? []).filter((p) =>
      p.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : Number(b[sort]) - Number(a[sort]),
    );
    return list.slice(0, MAX_ROWS);
  }, [data, query, sort]);

  async function onKill(p: ProcessInfo) {
    // Destructive action requires confirmation (spec §4).
    const ok = window.confirm(`Kill "${p.name}" (pid ${p.pid})? This can't be undone.`);
    if (!ok) return;
    setBusyPid(p.pid);
    try {
      await target.killProcess(p.pid);
    } finally {
      setBusyPid(null);
    }
  }

  const total = data?.length ?? 0;

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-2">
          <div className="glass flex h-8 items-center gap-2 rounded-[9px] px-2.5">
            <Search size={14} className="text-text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="w-32 bg-transparent text-[12px] text-text placeholder:text-text-dim focus:outline-none"
              spellCheck={false}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear filter">
                <X size={13} className="text-text-dim hover:text-text" />
              </button>
            )}
          </div>
        </div>
      }
    >
      {error ? (
        <div className="grid h-full place-items-center text-[13px] text-raspberry">
          Couldn’t read processes: {error}
        </div>
      ) : (
        <div className="glass overflow-hidden">
          {/* header */}
          <div className="grid grid-cols-[1fr_72px_84px_110px_84px] items-center gap-2 border-b border-stroke px-3 py-2 text-[11px] uppercase tracking-wide text-text-dim">
            <SortHead label="Name" active={sort === "name"} onClick={() => setSort("name")} />
            <span className="text-right">PID</span>
            <SortHead label="CPU" align="right" active={sort === "cpu"} onClick={() => setSort("cpu")} />
            <SortHead label="Memory" align="right" active={sort === "mem_bytes"} onClick={() => setSort("mem_bytes")} />
            <span className="text-right">Action</span>
          </div>
          {/* rows */}
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {rows.map((p) => (
              <div
                key={p.pid}
                className="grid grid-cols-[1fr_72px_84px_110px_84px] items-center gap-2 border-b border-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[12px] hover:bg-surface-hi"
              >
                <span className="truncate text-text">{p.name}</span>
                <span className="mono text-right text-text-dim">{p.pid}</span>
                <span className="mono text-right text-text">{formatPercent(p.cpu, 1)}</span>
                <span className="mono text-right text-text-dim">{formatBytes(p.mem_bytes)}</span>
                <span className="text-right">
                  <button
                    type="button"
                    onClick={() => onKill(p)}
                    disabled={busyPid === p.pid}
                    className="focus-ring rounded-[7px] px-2 py-0.5 text-[11px] text-text-dim transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.18)] hover:text-raspberry disabled:opacity-40"
                  >
                    {busyPid === p.pid ? "…" : "Kill"}
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-stroke px-3 py-2 text-[11px] text-text-dim">
            Showing {rows.length} of {total} processes{total > MAX_ROWS ? ` (top ${MAX_ROWS})` : ""}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function SortHead({
  label,
  active,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "uppercase tracking-wide transition-colors hover:text-text",
        align === "right" ? "text-right" : "text-left",
        active ? "text-raspberry" : "text-text-dim",
      )}
    >
      {label}
    </button>
  );
}

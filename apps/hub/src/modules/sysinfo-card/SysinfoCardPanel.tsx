import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Copy, Check, Loader2, Download, Terminal } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { SysinfoCard } from "@/target";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { bus } from "@/lib/bus";
import { cn } from "@/lib/cn";

type View = "card" | "raw";

/**
 * Sysinfo Card — pretty machine identity via
 * [fastfetch](https://github.com/fastfetch-cli/fastfetch). Two views: the
 * flattened key/value rows (fast to scan, cross-agent friendly) and the raw
 * JSON fastfetch emits. When fastfetch isn't installed we show a one-click
 * winget install line and stay useful (nothing else breaks).
 */
export function SysinfoCardPanel({ manifest }: { manifest: ModuleManifest }) {
  const [card, setCard] = useState<SysinfoCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("card");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await target.sysinfoCard();
      setCard(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyRaw() {
    if (!card?.raw_json) return;
    await navigator.clipboard.writeText(card.raw_json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function copyInstall() {
    if (!card?.install_hint) return;
    navigator.clipboard.writeText(card.install_hint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function runInstall() {
    if (!card?.install_hint) return;
    bus.emit("nav:go", { moduleId: "terminal" });
    setTimeout(() => bus.emit("terminal:run", { command: card.install_hint! }), 120);
  }

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1.5">
          {card?.available && (
            <div className="flex items-center gap-1 rounded-[8px] bg-surface-hi p-0.5">
              <ToggleButton active={view === "card"} onClick={() => setView("card")}>
                Card
              </ToggleButton>
              <ToggleButton active={view === "raw"} onClick={() => setView("raw")}>
                Raw
              </ToggleButton>
            </div>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-surface-hi px-2.5 text-[12px] text-text transition-colors hover:text-raspberry disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      }
    >
      {loading && !card && (
        <div className="flex items-center justify-center gap-2 px-4 py-16 text-[13px] text-text-dim">
          <Loader2 size={14} className="animate-spin text-raspberry" />
          Loading fastfetch…
        </div>
      )}

      {card && !card.available && (
        <GlassPanel interactive={false} className="p-6">
          <div className="mb-3 flex items-center gap-2 text-[13px] text-text">
            <Terminal size={14} className="text-raspberry" />
            fastfetch isn't installed on this machine.
          </div>
          <p className="mb-4 text-[12.5px] text-text-dim">
            Raspberry uses{" "}
            <a
              href="https://github.com/fastfetch-cli/fastfetch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-raspberry hover:underline"
            >
              fastfetch
            </a>{" "}
            — a modern, cross-platform neofetch replacement — to render this
            card. Install it once and every machine (this PC and remote agents)
            gets a rich identity panel.
          </p>
          <div className="mono flex items-center justify-between gap-3 rounded-[9px] bg-surface-hi px-3 py-2.5 text-[12px] text-text">
            <span className="truncate">{card.install_hint}</span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={copyInstall}
                className="focus-ring flex h-7 items-center gap-1 rounded-[6px] px-2 text-[11px] text-text-dim hover:bg-[rgba(255,255,255,0.06)] hover:text-text"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                Copy
              </button>
              <button
                type="button"
                onClick={runInstall}
                className="focus-ring flex h-7 items-center gap-1 rounded-[6px] bg-[rgba(var(--raspberry-rgb),0.18)] px-2 text-[11px] text-raspberry hover:bg-[rgba(var(--raspberry-rgb),0.28)]"
              >
                <Download size={11} />
                Run in Terminal
              </button>
            </span>
          </div>
        </GlassPanel>
      )}

      {card?.available && view === "card" && (
        <div className="grid grid-cols-[220px_1fr] gap-5">
          <SysinfoBadge card={card} />
          <GlassPanel interactive={false} className="overflow-hidden">
            <div className="border-b border-stroke bg-[rgba(255,255,255,0.02)] px-4 py-2.5 text-[11px] uppercase tracking-wide text-text-dim">
              System identity
            </div>
            <div className="grid grid-cols-1 divide-y divide-[rgba(255,255,255,0.04)]">
              {card.rows.map((row, i) => (
                <div
                  key={`${row.key}-${i}`}
                  className="grid grid-cols-[120px_1fr] gap-4 px-4 py-2 text-[12.5px]"
                >
                  <span className="text-text-dim">{row.key}</span>
                  <span className="mono truncate text-text">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-stroke bg-[rgba(255,255,255,0.02)] px-4 py-2 text-[11px] text-text-dim">
              fastfetch {card.version ?? "?"} · {card.rows.length} rows
            </div>
          </GlassPanel>
        </div>
      )}

      {card?.available && view === "raw" && (
        <GlassPanel interactive={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stroke bg-[rgba(255,255,255,0.02)] px-4 py-2 text-[11px] uppercase tracking-wide text-text-dim">
            <span>fastfetch --format json</span>
            <button
              type="button"
              onClick={copyRaw}
              className="focus-ring flex h-6 items-center gap-1 rounded-[6px] px-2 text-[10.5px] text-text-dim hover:bg-[rgba(255,255,255,0.06)] hover:text-text"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              Copy
            </button>
          </div>
          <pre className="mono max-h-[calc(100vh-320px)] overflow-auto whitespace-pre-wrap px-4 py-3 text-[11.5px] text-text/90">
            {card.raw_json}
          </pre>
        </GlassPanel>
      )}
    </PanelShell>
  );
}

function SysinfoBadge({ card }: { card: SysinfoCard }) {
  const host = card.rows.find((r) => r.key === "Host")?.value ?? "This PC";
  const os = card.rows.find((r) => r.key === "OS")?.value ?? "";
  return (
    <GlassPanel
      interactive={false}
      className="flex flex-col items-center justify-center gap-3 p-5"
    >
      <div
        className="grid h-24 w-24 place-items-center rounded-[18px] text-raspberry"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(var(--raspberry-rgb),0.35), rgba(var(--raspberry-rgb),0.08))",
          boxShadow: "inset 0 0 0 1px rgba(var(--raspberry-rgb),0.35)",
        }}
      >
        <RaspberryGlyph />
      </div>
      <div className="text-center">
        <div className="text-[13.5px] font-semibold text-text">{host}</div>
        <div className="mt-0.5 text-[11.5px] text-text-dim">{os}</div>
      </div>
      <div className="w-full border-t border-stroke pt-3 text-center text-[10.5px] uppercase tracking-wide text-text-dim">
        rendered by fastfetch
      </div>
    </GlassPanel>
  );
}

function RaspberryGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="22" r="10" fill="currentColor" opacity="0.85" />
      <circle cx="14" cy="17" r="4" fill="currentColor" opacity="0.55" />
      <circle cx="26" cy="17" r="4" fill="currentColor" opacity="0.55" />
      <circle cx="20" cy="14" r="3" fill="currentColor" opacity="0.7" />
      <path
        d="M20 8c3 0 4 2 3 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
        fill="none"
      />
    </svg>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring h-7 rounded-[6px] px-2 text-[11px] transition-colors",
        active ? "bg-[rgba(var(--raspberry-rgb),0.18)] text-raspberry" : "text-text-dim hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

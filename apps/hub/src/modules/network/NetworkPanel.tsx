import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { NetworkInfo } from "@/target";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

/** Network Dashboard (spec §10.3) — local IP, gateway, and interfaces.
 *  Ping/traceroute/active-connections land in a later pass. */
export function NetworkPanel({ manifest }: { manifest: ModuleManifest }) {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    target
      .networkInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <button
          type="button"
          onClick={load}
          aria-label="Refresh"
          className="focus-ring grid h-8 w-8 place-items-center rounded-[9px] text-text-dim transition-colors hover:bg-surface-hi hover:text-text"
        >
          <RefreshCw size={15} className={cn(loading && "animate-spin")} />
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Local IP" value={info?.local_ip ?? "—"} />
        <StatCard
          label="Gateway"
          value={info?.gateway_ip ?? "—"}
          sub={info?.gateway_mac ?? undefined}
        />
      </div>

      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-dim">
        Interfaces
      </h2>
      <GlassPanel interactive={false} className="overflow-hidden">
        {(info?.interfaces ?? []).map((iface) => (
          <div
            key={iface.name}
            className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.03)] px-3 py-2 text-[12px]"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: iface.is_up ? "rgb(var(--raspberry-rgb))" : "var(--text-dim)" }}
            />
            <span className="w-40 shrink-0 truncate text-text">{iface.friendly}</span>
            <span className="mono w-40 shrink-0 truncate text-text-dim">{iface.mac ?? "—"}</span>
            <span className="mono truncate text-text-dim">{iface.ipv4.join(", ") || "—"}</span>
          </div>
        ))}
        {!loading && (info?.interfaces?.length ?? 0) === 0 && (
          <div className="px-3 py-6 text-center text-[13px] text-text-dim">No interfaces.</div>
        )}
      </GlassPanel>
    </PanelShell>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassPanel interactive={false} className="flex flex-col gap-1 p-4">
      <span className="text-[11px] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="mono text-[20px] font-semibold text-text">{value}</span>
      {sub && <span className="mono text-[11px] text-text-dim">{sub}</span>}
    </GlassPanel>
  );
}

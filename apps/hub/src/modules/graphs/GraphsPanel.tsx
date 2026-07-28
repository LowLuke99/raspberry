import type { ModuleManifest } from "@/modules/types";
import { usePolling } from "@/hooks/usePolling";
import { useSeries } from "@/hooks/useSeries";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { LiveChart } from "@/ui/LiveChart";
import { formatBytes, formatPercent, formatRate } from "@/lib/format";

/** Resource Graphs (spec §10.11): larger live charts for the headline metrics.
 *  Overlay-across-machines mode arrives with the Command Deck in Phase 6. */
export function GraphsPanel({ manifest }: { manifest: ModuleManifest }) {
  const { data } = usePolling(() => target.systemSnapshot(), 1000);
  const memPct = data ? (data.mem_used / data.mem_total) * 100 : 0;

  const cpu = useSeries(data?.cpu_usage, 120);
  const mem = useSeries(data ? memPct : undefined, 120);
  const rx = useSeries(data?.net_rx_per_s, 120);
  const tx = useSeries(data?.net_tx_per_s, 120);

  const netPeak = Math.max(1, ...rx, ...tx);

  return (
    <PanelShell manifest={manifest}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Graph title="CPU" value={formatPercent(data?.cpu_usage ?? 0)} values={cpu} max={100} color="var(--raspberry)" />
        <Graph title="Memory" value={formatPercent(memPct)} values={mem} max={100} color="var(--purple)" />
        <Graph title="Network ↓ Rx" value={formatRate(data?.net_rx_per_s ?? 0)} values={rx} max={netPeak} color="#38bdf8" />
        <Graph title="Network ↑ Tx" value={formatRate(data?.net_tx_per_s ?? 0)} values={tx} max={netPeak} color="#34d399" />
      </div>
      <p className="mt-3 text-[11px] text-text-dim">
        {data ? `${data.host_name} · ${formatBytes(data.mem_used)} used` : "Sampling…"}
      </p>
    </PanelShell>
  );
}

function Graph({
  title,
  value,
  values,
  max,
  color,
}: {
  title: string;
  value: string;
  values: number[];
  max: number;
  color: string;
}) {
  return (
    <GlassPanel interactive={false} className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-text">{title}</span>
        <span className="mono text-[16px] text-text">{value}</span>
      </div>
      <LiveChart values={values} max={max} color={color} height={120} />
    </GlassPanel>
  );
}

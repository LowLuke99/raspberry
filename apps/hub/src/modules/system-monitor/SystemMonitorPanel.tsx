import type { ReactNode } from "react";
import type { ModuleManifest } from "@/modules/types";
import { usePolling } from "@/hooks/usePolling";
import { useSeries } from "@/hooks/useSeries";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { LiveChart } from "@/ui/LiveChart";
import { Meter } from "@/ui/Meter";
import { formatBytes, formatPercent, formatRate, formatUptime } from "@/lib/format";

/** System Monitor (spec §10.1) wired to the live Target — CPU, memory, network,
 *  per-core load, disks, and machine meta, refreshed once a second. */
export function SystemMonitorPanel({ manifest }: { manifest: ModuleManifest }) {
  const { data, error } = usePolling(() => target.systemSnapshot(), 1000);

  const memPct = data ? (data.mem_used / data.mem_total) * 100 : 0;
  const cpuHist = useSeries(data?.cpu_usage, 60);
  const memHist = useSeries(data ? memPct : undefined, 60);
  const netHist = useSeries(
    data ? data.net_rx_per_s + data.net_tx_per_s : undefined,
    60,
  );

  if (error) return <PanelShell manifest={manifest}><ErrorState error={error} /></PanelShell>;
  if (!data) return <PanelShell manifest={manifest}><LoadingState /></PanelShell>;

  const netPeak = Math.max(1, ...netHist);

  return (
    <PanelShell manifest={manifest}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BigStat
          label="CPU"
          value={formatPercent(data.cpu_usage)}
          sub={data.cpu_name}
          chart={<LiveChart values={cpuHist} max={100} color="var(--raspberry)" />}
        />
        <BigStat
          label="Memory"
          value={formatPercent(memPct)}
          sub={`${formatBytes(data.mem_used)} / ${formatBytes(data.mem_total)}`}
          chart={<LiveChart values={memHist} max={100} color="var(--purple)" />}
        />
        <BigStat
          label="Network"
          value={formatRate(data.net_rx_per_s + data.net_tx_per_s)}
          sub={`↓ ${formatRate(data.net_rx_per_s)}   ↑ ${formatRate(data.net_tx_per_s)}`}
          chart={<LiveChart values={netHist} max={netPeak} color="#38bdf8" />}
        />
      </div>

      {/* Per-core load */}
      <SectionTitle>Cores</SectionTitle>
      <GlassPanel interactive={false} className="p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.cores.map((core, i) => (
            <div key={core.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-dim">#{i}</span>
                <span className="mono text-text">{formatPercent(core.usage)}</span>
              </div>
              <Meter value={core.usage / 100} />
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Disks */}
      <SectionTitle>Disks</SectionTitle>
      <GlassPanel interactive={false} className="flex flex-col gap-3 p-4">
        {data.disks.map((disk) => {
          const used = disk.total - disk.available;
          return (
            <div key={disk.mount} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text">
                  {disk.mount}{" "}
                  <span className="text-text-dim">{disk.name}</span>
                </span>
                <span className="mono text-text-dim">
                  {formatBytes(used)} / {formatBytes(disk.total)}
                </span>
              </div>
              <Meter value={disk.total > 0 ? used / disk.total : 0} color="var(--purple)" />
            </div>
          );
        })}
      </GlassPanel>

      {/* Machine meta */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-text-dim">
        <Meta k="Host" v={data.host_name} />
        <Meta k="OS" v={data.os_long} />
        <Meta k="Uptime" v={formatUptime(data.uptime_secs)} />
        <Meta k="Processes" v={String(data.process_count)} />
        <Meta k="Swap" v={`${formatBytes(data.swap_used)} / ${formatBytes(data.swap_total)}`} />
      </div>
    </PanelShell>
  );
}

function BigStat({
  label,
  value,
  sub,
  chart,
}: {
  label: string;
  value: string;
  sub: string;
  chart: ReactNode;
}) {
  return (
    <GlassPanel interactive={false} className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-text-dim">{label}</span>
        <span className="mono text-[22px] font-semibold text-text">{value}</span>
      </div>
      <div className="-mx-1">{chart}</div>
      <span className="truncate text-[11px] text-text-dim">{sub}</span>
    </GlassPanel>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider text-text-dim">
      {children}
    </h2>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span className="uppercase tracking-wide">{k}</span>{" "}
      <span className="text-text">{v}</span>
    </span>
  );
}

function LoadingState() {
  return <div className="grid h-full place-items-center text-[13px] text-text-dim">Reading system…</div>;
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center text-[13px] text-raspberry">
      Couldn’t read system stats: {error}
    </div>
  );
}

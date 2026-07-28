import { useEffect, useState } from "react";
import { ArrowDownUp, Clock, Cpu, MemoryStick } from "lucide-react";
import { useAppStore } from "@/state/useAppStore";
import { usePolling } from "@/hooks/usePolling";
import { target } from "@/target";
import { formatBytes, formatPercent, formatRate, formatUptime } from "@/lib/format";

/**
 * Bottom status bar (spec §6) for the currently-targeted machine — now wired to
 * the live Target (real data in the native app, sample data in the browser
 * preview). The badge reflects which. The clock is always real.
 */
export function StatusBar() {
  const machine = useAppStore((s) => s.activeMachine);
  const clock = useClock();
  const { data } = usePolling(() => target.systemSnapshot(), 2000);
  const tintVar = machine.tint === "purple" ? "--purple-rgb" : "--raspberry-rgb";

  const host = data?.host_name ?? machine.hostname;
  const memPct = data ? (data.mem_used / data.mem_total) * 100 : 0;

  return (
    <footer
      className="flex items-center gap-4 px-3 text-[11px] text-text-dim"
      style={{ height: "var(--statusbar-h)" }}
    >
      {/* Which machine these stats belong to. */}
      <span className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: `rgb(var(${tintVar}))` }}
        />
        <span className="font-medium text-text">{host}</span>
      </span>

      <Divider />
      <Segment icon={<Cpu size={12} />} value={data ? formatPercent(data.cpu_usage) : "—"} />
      <Segment
        icon={<MemoryStick size={12} />}
        value={data ? `${formatBytes(data.mem_used)} / ${formatBytes(data.mem_total)}` : "—"}
      />
      <Meter label="mem" value={memPct} />
      <Segment
        icon={<ArrowDownUp size={12} />}
        value={data ? formatRate(data.net_rx_per_s + data.net_tx_per_s) : "—"}
      />

      <Divider />
      <Metric label="up" value={data ? formatUptime(data.uptime_secs) : "—"} />
      <Metric label="proc" value={data ? String(data.process_count) : "—"} />

      {/* right side */}
      <div className="ml-auto flex items-center gap-4">
        <LiveTag live={target.isLive} />
        <Segment icon={<Clock size={12} />} value={clock} />
      </div>
    </footer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="mono text-text">{value}</span>
    </span>
  );
}

function Segment({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-text-dim">{icon}</span>
      <span className="mono text-text">{value}</span>
    </span>
  );
}

/** Compact inline meter for the memory percentage. */
function Meter({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5" title={`${label} ${formatPercent(value)}`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <span
          className="block h-full rounded-full bg-raspberry transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
    </span>
  );
}

function LiveTag({ live }: { live: boolean }) {
  return (
    <span
      className="mono flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-wider"
      style={{
        background: live ? "rgba(var(--raspberry-rgb),0.16)" : "rgba(var(--purple-rgb),0.16)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: live ? "rgb(var(--raspberry-rgb))" : "rgb(var(--purple-rgb))" }}
      />
      {live ? "live" : "sample"}
    </span>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-stroke" />;
}

/** Real wall clock, updated once a second. */
function useClock(): string {
  const [now, setNow] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

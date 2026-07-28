import { useEffect, useState } from "react";
import { GitBranch, Folder, ArrowDownUp, BatteryFull, Clock } from "lucide-react";
import { useAppStore } from "@/state/useAppStore";
import { MOCK_STATUS } from "@/lib/mock";

/**
 * Bottom status bar (spec §6) for the *currently targeted* machine. All metrics
 * are mock/sample for Phase 1 and tagged as such; only the clock is real. The
 * machine name is shown up front so you never misread whose stats these are.
 */
export function StatusBar() {
  const machine = useAppStore((s) => s.activeMachine);
  const clock = useClock();
  const tintVar = machine.tint === "purple" ? "--purple-rgb" : "--raspberry-rgb";

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
        <span className="font-medium text-text">{machine.hostname}</span>
      </span>

      <Divider />
      <Metric label="CPU" value={MOCK_STATUS.cpu} />
      <Metric label="GPU" value={MOCK_STATUS.gpu} />
      <Metric label="RAM" value={MOCK_STATUS.ram} />
      <Segment icon={<ArrowDownUp size={12} />} value={MOCK_STATUS.net} />
      <Segment icon={<BatteryFull size={12} />} value={MOCK_STATUS.battery} />

      <Divider />
      <Segment icon={<Folder size={12} />} value={MOCK_STATUS.cwd} />
      <Metric label="jobs" value={String(MOCK_STATUS.jobs)} />
      <Segment icon={<GitBranch size={12} />} value={MOCK_STATUS.gitBranch} />

      {/* right side */}
      <div className="ml-auto flex items-center gap-4">
        <span className="rounded-full bg-[rgba(var(--purple-rgb),0.14)] px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-text-dim">
          sample data
        </span>
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
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

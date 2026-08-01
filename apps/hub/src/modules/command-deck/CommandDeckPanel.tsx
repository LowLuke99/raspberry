import { useEffect, useState } from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Radio,
  Terminal as TerminalIcon,
  ListTree,
  Radar,
  BookText,
  ScrollText,
  ShieldCheck,
  Gauge,
  Globe,
  Wrench,
  FolderTree,
} from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { target, type SystemSnapshot } from "@/target";
import { bus } from "@/lib/bus";
import { formatBytes, formatPercent, formatRate, formatUptime } from "@/lib/format";
import { useAppStore } from "@/state/useAppStore";
import { SectionHeroRow } from "./SectionHeroRow";

const REFRESH_MS = 2000;

const QUICK_JUMPS: {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { id: "terminal", label: "Terminal", hint: "Shell", icon: TerminalIcon },
  { id: "commands", label: "Commands", hint: "Cheat sheet", icon: BookText },
  { id: "system-monitor", label: "System Monitor", hint: "Live specs", icon: Gauge },
  { id: "process-explorer", label: "Processes", hint: "Kill things", icon: ListTree },
  { id: "network", label: "Network", hint: "IP + adapters", icon: Globe },
  { id: "lan-manager", label: "LAN", hint: "Discover", icon: Radar },
  { id: "storage", label: "Storage", hint: "Drives", icon: HardDrive },
  { id: "security", label: "Security", hint: "Defender + fw", icon: ShieldCheck },
  { id: "logs", label: "Logs", hint: "Event log", icon: ScrollText },
  { id: "files", label: "Files", hint: "Local tree", icon: FolderTree },
  { id: "dev-toolbox", label: "Dev Toolbox", hint: "JSON, hash…", icon: Wrench },
];

export function CommandDeckPanel({ manifest }: { manifest: ModuleManifest }) {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    let cancel: number | undefined;
    const tick = () => {
      target.systemSnapshot().then((s) => {
        if (!alive) return;
        setSnap(s);
        cancel = window.setTimeout(tick, REFRESH_MS);
      });
    };
    tick();
    return () => {
      alive = false;
      if (cancel !== undefined) clearTimeout(cancel);
    };
  }, []);

  return (
    <PanelShell manifest={manifest}>
      <div className="flex flex-col gap-4">
        {/* Machine hero */}
        <HeroCard snap={snap} />

        {/* Section hero tiles */}
        <SectionHeroRow />

        {/* Vital stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={<Cpu size={14} />}
            label="CPU"
            value={snap ? formatPercent(snap.cpu_usage, 0) : "—"}
            sub={snap?.cpu_name || ""}
            pct={snap?.cpu_usage ?? 0}
          />
          <StatTile
            icon={<MemoryStick size={14} />}
            label="Memory"
            value={
              snap
                ? formatPercent((snap.mem_used / Math.max(snap.mem_total, 1)) * 100, 0)
                : "—"
            }
            sub={
              snap ? `${formatBytes(snap.mem_used)} / ${formatBytes(snap.mem_total)}` : ""
            }
            pct={snap ? (snap.mem_used / Math.max(snap.mem_total, 1)) * 100 : 0}
          />
          <StatTile
            icon={<Radio size={14} />}
            label="Network"
            value={snap ? formatRate(snap.net_rx_per_s + snap.net_tx_per_s) : "—"}
            sub={
              snap
                ? `↓${formatRate(snap.net_rx_per_s)}  ↑${formatRate(snap.net_tx_per_s)}`
                : ""
            }
          />
          <StatTile
            icon={<ListTree size={14} />}
            label="Processes"
            value={snap ? String(snap.process_count) : "—"}
            sub={snap ? `up ${formatUptime(snap.uptime_secs)}` : ""}
          />
        </div>

        {/* Storage strip */}
        <div>
          <SectionLabel>Volumes</SectionLabel>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(snap?.disks ?? []).map((d) => {
              const used = d.total - d.available;
              const pct = d.total > 0 ? (used / d.total) * 100 : 0;
              return (
                <GlassPanel key={d.mount} interactive={false} className="p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <HardDrive size={13} className="text-raspberry shrink-0" />
                      <span className="mono truncate text-[12px] text-text">{d.mount}</span>
                    </div>
                    <span className="mono text-[10.5px] text-text-dim">{formatPercent(pct, 0)}</span>
                  </div>
                  <BarMeter pct={pct} />
                  <div className="mono mt-1.5 flex justify-between text-[10.5px] text-text-dim">
                    <span>{formatBytes(d.available)} free</span>
                    <span>{formatBytes(d.total)}</span>
                  </div>
                </GlassPanel>
              );
            })}
            {(!snap || snap.disks.length === 0) && (
              <div className="col-span-full text-[12px] text-text-dim">No volumes yet.</div>
            )}
          </div>
        </div>

        {/* Jump grid */}
        <div>
          <SectionLabel>Jump to</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {QUICK_JUMPS.map((j) => (
              <JumpCard key={j.id} {...j} />
            ))}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

/* ── pieces ──────────────────────────────────────────────────────── */

function HeroCard({ snap }: { snap: SystemSnapshot | null }) {
  const machine = useAppStore((s) => s.activeMachine);
  return (
    <GlassPanel interactive={false} raised className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.28),transparent_60%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-wider text-text-dim">Active machine</div>
          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="text-[22px] font-semibold text-text">
              {snap?.host_name || machine.hostname}
            </h2>
            <span className="mono text-[11px] text-text-dim">{snap?.os_long || ""}</span>
          </div>
          <div className="mono mt-1 text-[11.5px] text-text-dim">
            {snap ? `${snap.cores.length} cores · uptime ${formatUptime(snap.uptime_secs)}` : "…"}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  pct,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  pct?: number;
}) {
  return (
    <GlassPanel interactive={false} className="p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-raspberry">{icon}</span>
        <span className="mono text-[10px] uppercase tracking-wider text-text-dim">{label}</span>
      </div>
      <div className="text-[22px] font-semibold text-text">{value}</div>
      <div className="mono mt-0.5 truncate text-[10.5px] text-text-dim">{sub}</div>
      {pct !== undefined && (
        <div className="mt-2">
          <BarMeter pct={pct} />
        </div>
      )}
    </GlassPanel>
  );
}

function BarMeter({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone =
    clamped > 90 ? "rgb(251,44,80)" : clamped > 75 ? "rgb(251,191,36)" : "rgb(225,29,72)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
      <motion.div
        className="h-full rounded-full"
        style={{ background: tone }}
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

function JumpCard({
  id,
  label,
  hint,
  icon: Icon,
}: {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={() => bus.emit("nav:go", { moduleId: id })}
      className={cn(
        "focus-ring group flex items-center gap-3 rounded-[12px] bg-surface p-3 text-left shadow-[var(--hairline)] transition-colors",
        "hover:bg-surface-hi",
      )}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-surface-hi text-text-dim shadow-[var(--hairline)] transition-colors group-hover:text-raspberry">
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-medium text-text">{label}</div>
        <div className="mono truncate text-[10px] uppercase tracking-wider text-text-dim">{hint}</div>
      </div>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono text-[10px] uppercase tracking-wider text-text-dim">{children}</div>
  );
}

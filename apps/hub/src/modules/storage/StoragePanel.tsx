import { useEffect, useMemo, useState } from "react";
import { HardDrive, Usb, Cpu, RefreshCw } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { target, type DiskInfo, type PhysicalDisk } from "@/target";
import { formatBytes, formatPercent } from "@/lib/format";

/**
 * Storage panel: volumes (from sysinfo — the same list sysmon uses) plus
 * physical disks (SSD/HDD/USB with health) from PowerShell's Get-PhysicalDisk.
 * The volume ring shows used %, tinted by remaining space.
 */
export function StoragePanel({ manifest }: { manifest: ModuleManifest }) {
  const [volumes, setVolumes] = useState<DiskInfo[]>([]);
  const [physical, setPhysical] = useState<PhysicalDisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([target.systemSnapshot(), target.storageDisks()])
      .then(([snap, disks]) => {
        if (!alive) return;
        setVolumes(snap.disks);
        setPhysical(disks);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          className="focus-ring flex items-center gap-1.5 rounded-[9px] bg-surface-hi px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:text-raspberry"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <SectionLabel>Volumes</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {volumes.map((v) => (
            <VolumeRing key={`${v.mount}-${v.name}`} v={v} />
          ))}
          {volumes.length === 0 && !loading && <EmptyRow label="No volumes." />}
        </div>

        <SectionLabel>Physical disks</SectionLabel>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {physical.map((d, i) => (
            <PhysicalCard key={`${d.serial}-${i}`} d={d} />
          ))}
          {physical.length === 0 && !loading && (
            <EmptyRow label="No physical-disk data (requires PowerShell on Windows)." />
          )}
        </div>
      </div>
    </PanelShell>
  );
}

/* ── volume ring ─────────────────────────────────────────────────── */

function VolumeRing({ v }: { v: DiskInfo }) {
  const used = v.total - v.available;
  const pct = v.total > 0 ? (used / v.total) * 100 : 0;
  const stroke = pct > 90 ? "rgb(251,44,80)" : pct > 75 ? "rgb(251,191,36)" : "rgb(225,29,72)";
  const c = 2 * Math.PI * 42;
  const offset = c - (c * Math.min(pct, 100)) / 100;
  return (
    <GlassPanel interactive={false} className="flex items-center gap-4 p-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="7" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke={stroke}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 400ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center leading-none">
            <div className="text-[15px] font-semibold text-text">{formatPercent(pct, 0)}</div>
            <div className="mono mt-1 text-[9px] uppercase tracking-wider text-text-dim">used</div>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <HardDrive size={14} className="text-raspberry" />
          <span className="truncate text-[13px] font-medium text-text">{v.mount}</span>
        </div>
        <div className="mono mt-0.5 truncate text-[11px] text-text-dim">{v.name || "(no label)"}</div>
        <div className="mt-2 space-y-0.5 text-[11.5px] text-text-dim">
          <Row k="Free" v={formatBytes(v.available)} />
          <Row k="Used" v={formatBytes(used)} />
          <Row k="Total" v={formatBytes(v.total)} />
        </div>
      </div>
    </GlassPanel>
  );
}

/* ── physical disk ───────────────────────────────────────────────── */

function PhysicalCard({ d }: { d: PhysicalDisk }) {
  const icon = iconFor(d);
  const healthTint = useMemo(() => {
    if (d.health === "Healthy") return "rgba(52,211,153,0.16)";
    if (d.health === "Warning") return "rgba(251,191,36,0.20)";
    if (d.health === "Unhealthy") return "rgba(251,44,80,0.20)";
    return "rgba(148,163,184,0.16)";
  }, [d.health]);
  return (
    <GlassPanel interactive={false} className="flex items-start gap-3 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-surface-hi text-raspberry shadow-[var(--hairline)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-text">
            {d.friendly_name || d.model || "Unnamed disk"}
          </span>
          <span
            className="mono rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text"
            style={{ background: healthTint }}
          >
            {d.health || "?"}
          </span>
        </div>
        <div className="mono mt-0.5 truncate text-[11px] text-text-dim">
          {[d.media_type, d.bus_type].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11.5px] text-text-dim">
          <Row k="Capacity" v={formatBytes(d.size_bytes)} />
          <Row k="Status" v={d.operational_status || "—"} />
          {d.serial && <Row k="Serial" v={d.serial} />}
        </div>
      </div>
    </GlassPanel>
  );
}

function iconFor(d: PhysicalDisk) {
  if (d.bus_type === "USB") return <Usb size={18} strokeWidth={1.75} />;
  if (d.bus_type === "NVMe" || d.media_type === "SSD") return <Cpu size={18} strokeWidth={1.75} />;
  return <HardDrive size={18} strokeWidth={1.75} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono text-[10px] uppercase tracking-wider text-text-dim">{children}</div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3")}>
      <span className="mono text-[10px] uppercase tracking-wider text-text-dim">{k}</span>
      <span className="mono truncate text-text">{v}</span>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <GlassPanel interactive={false} className="col-span-full p-4 text-center text-[12px] text-text-dim">
      {label}
    </GlassPanel>
  );
}

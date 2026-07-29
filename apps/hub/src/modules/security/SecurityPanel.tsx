import { useEffect, useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Lock,
  Package,
  UserCog,
  RefreshCw,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { target, type SecuritySnapshot } from "@/target";

const UAC_LABELS: Record<number, string> = {
  0: "Disabled",
  1: "Prompt for credentials (secure desktop)",
  2: "Prompt for consent (default)",
  3: "Prompt for credentials",
  4: "Prompt for consent",
  5: "Always notify (most secure)",
};

export function SecurityPanel({ manifest }: { manifest: ModuleManifest }) {
  const [snap, setSnap] = useState<SecuritySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    target
      .securityStatus()
      .then((s) => alive && setSnap(s))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  const score = snap ? computeScore(snap) : 0;

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
        {/* score + warnings */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
          <ScoreCard score={score} />
          <WarningsCard warnings={snap?.warnings ?? []} loading={loading} />
        </div>

        {/* defender + firewall */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {snap && <DefenderCard snap={snap} />}
          {snap && <FirewallCard snap={snap} />}
        </div>

        {/* bitlocker + uac */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {snap && <BitlockerCard snap={snap} />}
          {snap && <UacCard level={snap.uac_level} />}
        </div>

        {/* hotfixes */}
        {snap && <HotfixesCard snap={snap} />}
      </div>
    </PanelShell>
  );
}

function computeScore(s: SecuritySnapshot): number {
  let score = 0;
  const max = 6;
  if (s.defender.enabled) score++;
  if (s.defender.realtime) score++;
  if (s.defender.tamper_protection) score++;
  if (s.firewall.length > 0 && s.firewall.every((p) => p.enabled)) score++;
  if (s.bitlocker.some((v) => v.protection_status === "On")) score++;
  if (s.uac_level !== null && s.uac_level >= 2) score++;
  return Math.round((score / max) * 100);
}

function ScoreCard({ score }: { score: number }) {
  const tone =
    score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-300" : "text-raspberry";
  const c = 2 * Math.PI * 44;
  const dash = c - (c * score) / 100;
  return (
    <GlassPanel interactive={false} className="flex flex-col items-center gap-2 p-5">
      <div className="mono text-[10px] uppercase tracking-wider text-text-dim">Posture</div>
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={dash}
            className={tone}
            style={{ transition: "stroke-dashoffset 500ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center leading-none">
            <div className={cn("text-[28px] font-semibold", tone)}>{score}</div>
            <div className="mono mt-1 text-[9px] uppercase tracking-wider text-text-dim">of 100</div>
          </div>
        </div>
      </div>
      <div className="text-[12px] text-text-dim">
        {score >= 80 ? "Locked down." : score >= 50 ? "Room to improve." : "Needs attention."}
      </div>
    </GlassPanel>
  );
}

function WarningsCard({ warnings, loading }: { warnings: string[]; loading: boolean }) {
  return (
    <GlassPanel interactive={false} className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert size={14} className="text-raspberry" />
        <span className="mono text-[10px] uppercase tracking-wider text-text-dim">Attention</span>
      </div>
      {loading ? (
        <div className="text-[12px] text-text-dim">Checking…</div>
      ) : warnings.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] text-text">
          <ShieldCheck size={16} className="text-green-400" />
          Nothing to worry about right now.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-text">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-raspberry" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

function DefenderCard({ snap }: { snap: SecuritySnapshot }) {
  const d = snap.defender;
  return (
    <GlassPanel interactive={false} className="p-4">
      <CardHeader icon={<Shield size={14} />} label="Windows Defender" />
      <div className="space-y-1 text-[12.5px]">
        <StatusRow k="Antivirus" ok={d.enabled} label={d.enabled ? "Enabled" : "Disabled"} />
        <StatusRow k="Real-time" ok={d.realtime} label={d.realtime ? "On" : "Off"} />
        <StatusRow k="Tamper protection" ok={d.tamper_protection} label={d.tamper_protection ? "On" : "Off"} />
        <Row k="Signature age" v={d.signature_age_days < 0 ? "—" : `${d.signature_age_days}d`} />
        <Row k="Last quick scan" v={d.last_quick_scan_days < 0 ? "—" : `${d.last_quick_scan_days}d ago`} />
        <Row k="Last full scan" v={d.last_full_scan_days < 0 ? "—" : `${d.last_full_scan_days}d ago`} />
        <Row k="Engine" v={d.engine_version || "—"} />
      </div>
    </GlassPanel>
  );
}

function FirewallCard({ snap }: { snap: SecuritySnapshot }) {
  return (
    <GlassPanel interactive={false} className="p-4">
      <CardHeader icon={<Flame size={14} />} label="Firewall" />
      {snap.firewall.length === 0 ? (
        <div className="text-[12px] text-text-dim">Unable to read firewall state.</div>
      ) : (
        <div className="space-y-1">
          {snap.firewall.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-text">{p.name}</span>
              <span className="flex items-center gap-2">
                <span className="mono text-[10px] uppercase tracking-wider text-text-dim">
                  in:{p.default_inbound} · out:{p.default_outbound}
                </span>
                <StatusPill ok={p.enabled} label={p.enabled ? "On" : "Off"} />
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}

function BitlockerCard({ snap }: { snap: SecuritySnapshot }) {
  return (
    <GlassPanel interactive={false} className="p-4">
      <CardHeader icon={<Lock size={14} />} label="BitLocker" />
      {snap.bitlocker.length === 0 ? (
        <div className="text-[12px] text-text-dim">
          No BitLocker data. Requires elevated privileges or drives without BitLocker.
        </div>
      ) : (
        <div className="space-y-1">
          {snap.bitlocker.map((v) => (
            <div key={v.mount} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="mono text-text">{v.mount}</span>
              <span className="flex items-center gap-2">
                <span className="mono text-[10px] uppercase tracking-wider text-text-dim">
                  {v.volume_status || "—"} · {v.encryption_percent}%
                </span>
                <StatusPill ok={v.protection_status === "On"} label={v.protection_status} />
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}

function UacCard({ level }: { level: number | null }) {
  const ok = level !== null && level >= 2;
  const label = level !== null ? UAC_LABELS[level] ?? `Level ${level}` : "Unknown";
  return (
    <GlassPanel interactive={false} className="p-4">
      <CardHeader icon={<UserCog size={14} />} label="User Account Control" />
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="text-text">{label}</span>
        <StatusPill ok={ok} label={ok ? "OK" : "Weak"} />
      </div>
    </GlassPanel>
  );
}

function HotfixesCard({ snap }: { snap: SecuritySnapshot }) {
  return (
    <GlassPanel interactive={false} className="p-4">
      <CardHeader icon={<Package size={14} />} label="Recent Windows updates" />
      {snap.hotfixes.length === 0 ? (
        <div className="text-[12px] text-text-dim">No hotfix data available.</div>
      ) : (
        <div className="overflow-hidden rounded-[8px] shadow-[var(--hairline)]">
          <table className="w-full text-[12px]">
            <thead className="mono text-[10px] uppercase tracking-wider text-text-dim">
              <tr className="bg-[rgba(0,0,0,0.2)]">
                <th className="p-2 text-left">KB</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Installed</th>
              </tr>
            </thead>
            <tbody>
              {snap.hotfixes.map((h) => (
                <tr key={h.id} className="border-t border-[rgba(255,255,255,0.04)]">
                  <td className="mono p-2 text-text">{h.id}</td>
                  <td className="p-2 text-text-dim">{h.description}</td>
                  <td className="mono p-2 text-text-dim">{formatShortDate(h.installed_on)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassPanel>
  );
}

function CardHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-raspberry">{icon}</span>
      <span className="mono text-[10px] uppercase tracking-wider text-text-dim">{label}</span>
    </div>
  );
}

function StatusRow({ k, ok, label }: { k: string; ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-dim">{k}</span>
      <StatusPill ok={ok} label={label} />
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="mono rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-text"
      style={{
        background: ok ? "rgba(52,211,153,0.16)" : "rgba(251,44,80,0.20)",
      }}
    >
      {label}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-dim">{k}</span>
      <span className="mono truncate text-text">{v}</span>
    </div>
  );
}

function formatShortDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.split("T")[0] || s;
  return d.toISOString().split("T")[0]!;
}

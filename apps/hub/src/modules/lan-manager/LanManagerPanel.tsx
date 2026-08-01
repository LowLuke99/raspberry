import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Zap, Router, Radar, Copy, Check } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { LanDevice, NetworkInfo } from "@/target";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

type ScanMode = "fast" | "deep";

/** Local Network Manager (spec §10.4) — ARP-cache fast scan + full /24 deep
 *  sweep with hostname and latency, plus Wake-on-LAN and quick copy. */
export function LanManagerPanel({ manifest }: { manifest: ModuleManifest }) {
  const [devices, setDevices] = useState<LanDevice[]>([]);
  const [gatewayIp, setGatewayIp] = useState<string | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("fast");
  const [lastMode, setLastMode] = useState<ScanMode | null>(null);
  const [wakingMac, setWakingMac] = useState<string | null>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const runScan = useCallback(async (mode: ScanMode) => {
    setScanning(true);
    setScanMode(mode);
    try {
      const [list, info] = await Promise.all([
        mode === "deep" ? target.scanLanDeep() : target.scanLan(),
        target.networkInfo().catch((): NetworkInfo | null => null),
      ]);
      setDevices(list);
      setGatewayIp(info?.gateway_ip ?? null);
      setLocalIp(info?.local_ip ?? null);
      setLastMode(mode);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    runScan("fast");
  }, [runScan]);

  async function wake(device: LanDevice) {
    if (!window.confirm(`Send a Wake-on-LAN packet to ${device.ip} (${device.mac})?`)) return;
    setWakingMac(device.mac);
    try {
      await target.wakeOnLan(device.mac);
      showToast(`Magic packet sent to ${device.mac}`);
    } catch (e) {
      showToast(`Wake failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWakingMac(null);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function copyIp(ip: string) {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedIp(ip);
      setTimeout(() => setCopiedIp((prev) => (prev === ip ? null : prev)), 1400);
    } catch {
      showToast("Copy failed");
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) =>
      [d.ip, d.mac, d.vendor, d.hostname ?? ""].some((f) => f.toLowerCase().includes(q)),
    );
  }, [devices, filter]);

  const withHostnames = devices.filter((d) => d.hostname).length;
  const respondedCount = devices.filter((d) => d.latency_ms !== null).length;

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => runScan("fast")}
            disabled={scanning}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-surface-hi px-2.5 text-[12px] text-text transition-colors hover:text-raspberry disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(scanning && scanMode === "fast" && "animate-spin")} />
            {scanning && scanMode === "fast" ? "Scanning…" : "Rescan"}
          </button>
          <button
            type="button"
            onClick={() => runScan("deep")}
            disabled={scanning}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-[rgba(var(--raspberry-rgb),0.15)] px-2.5 text-[12px] font-medium text-raspberry transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.25)] disabled:opacity-50"
          >
            <Radar size={13} className={cn(scanning && scanMode === "deep" && "animate-pulse")} />
            {scanning && scanMode === "deep" ? "Sweeping /24…" : "Deep Scan"}
          </button>
        </div>
      }
    >
      {toast && (
        <div className="mb-3 rounded-[10px] bg-[rgba(var(--raspberry-rgb),0.14)] px-3 py-2 text-[12px] text-text">
          {toast}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by IP, hostname, vendor…"
          className="focus-ring h-8 flex-1 rounded-[9px] bg-surface-hi px-3 text-[12px] text-text placeholder:text-text-dim"
        />
        <span className="mono text-[11px] text-text-dim">
          {filtered.length}/{devices.length}
        </span>
      </div>

      <GlassPanel interactive={false} className="overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_140px_150px_70px_88px] items-center gap-2 border-b border-stroke px-3 py-2 text-[11px] uppercase tracking-wide text-text-dim">
          <span>IP</span>
          <span>Hostname</span>
          <span>MAC</span>
          <span>Vendor</span>
          <span className="text-right">RTT</span>
          <span className="text-right">Wake</span>
        </div>
        <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
          {filtered.map((d) => {
            const isGateway = d.ip === gatewayIp;
            const isSelf = d.ip === localIp;
            const responded = d.latency_ms !== null;
            return (
              <div
                key={d.mac + d.ip}
                className="group grid grid-cols-[140px_1fr_140px_150px_70px_88px] items-center gap-2 border-b border-[rgba(255,255,255,0.03)] px-3 py-2 text-[12px] hover:bg-surface-hi"
              >
                <span className="mono flex items-center gap-1.5 text-text">
                  {isGateway && <Router size={12} className="text-raspberry" />}
                  <button
                    type="button"
                    onClick={() => copyIp(d.ip)}
                    className="focus-ring flex items-center gap-1 rounded-[5px] px-0.5 hover:text-raspberry"
                    aria-label={`Copy ${d.ip}`}
                  >
                    {d.ip}
                    {copiedIp === d.ip ? (
                      <Check size={10} className="text-emerald-400" />
                    ) : (
                      <Copy size={10} className="opacity-0 transition-opacity group-hover:opacity-60" />
                    )}
                  </button>
                </span>
                <span className="truncate text-text-dim">
                  {d.hostname ?? (isSelf ? <em className="not-italic text-text/60">this machine</em> : <span className="opacity-40">—</span>)}
                </span>
                <span className="mono truncate text-text-dim">{d.mac}</span>
                <span className="truncate text-text-dim">{d.vendor}</span>
                <span className="mono text-right text-[11px]">
                  {responded ? (
                    <LatencyPill ms={d.latency_ms!} />
                  ) : (
                    <span className="opacity-40">—</span>
                  )}
                </span>
                <span className="text-right">
                  <button
                    type="button"
                    onClick={() => wake(d)}
                    disabled={wakingMac === d.mac}
                    className="focus-ring inline-flex items-center gap-1 rounded-[7px] px-2 py-0.5 text-[11px] text-text-dim transition-colors hover:bg-[rgba(var(--purple-rgb),0.2)] hover:text-text disabled:opacity-40"
                  >
                    <Zap size={11} />
                    {wakingMac === d.mac ? "…" : "WoL"}
                  </button>
                </span>
              </div>
            );
          })}
          {!scanning && devices.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-text-dim">
              <p className="mb-1">No devices in the ARP cache yet.</p>
              <p className="text-[12px] opacity-70">
                Hit <span className="text-raspberry">Deep Scan</span> to actively probe your /24.
              </p>
            </div>
          )}
          {!scanning && devices.length > 0 && filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-text-dim">
              No matches for “{filter}”.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-stroke px-3 py-2 text-[11px] text-text-dim">
          <span>
            {devices.length} device{devices.length === 1 ? "" : "s"} discovered
            {lastMode === "deep" && (
              <>
                {" · "}
                <span className="text-emerald-400/80">{respondedCount}</span> responded
                {" · "}
                <span className="text-text/70">{withHostnames}</span> named
              </>
            )}
          </span>
          <span className="opacity-60">
            {lastMode === "deep"
              ? "Deep scan: ping-sweep of local /24"
              : "Fast scan: OS ARP cache only"}
          </span>
        </div>
      </GlassPanel>
    </PanelShell>
  );
}

/** Color-coded latency badge — green under 10ms, amber under 50, dim beyond. */
function LatencyPill({ ms }: { ms: number }) {
  const tone =
    ms < 10 ? "text-emerald-400" : ms < 50 ? "text-amber-300" : "text-text-dim";
  return <span className={cn("mono", tone)}>{ms}ms</span>;
}

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Zap, Router } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { LanDevice, NetworkInfo } from "@/target";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

/** Local Network Manager (spec §10.4) — discover LAN devices (ARP), vendor
 *  lookup, and Wake-on-LAN. Live map + mDNS agent detection come in Phases 5-6. */
export function LanManagerPanel({ manifest }: { manifest: ModuleManifest }) {
  const [devices, setDevices] = useState<LanDevice[]>([]);
  const [gatewayIp, setGatewayIp] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [wakingMac, setWakingMac] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const [list, info] = await Promise.all([
        target.scanLan(),
        target.networkInfo().catch((): NetworkInfo | null => null),
      ]);
      setDevices(list);
      setGatewayIp(info?.gateway_ip ?? null);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  async function wake(device: LanDevice) {
    // State-changing action → confirm first (spec §4).
    if (!window.confirm(`Send a Wake-on-LAN packet to ${device.ip} (${device.mac})?`)) return;
    setWakingMac(device.mac);
    try {
      await target.wakeOnLan(device.mac);
      setToast(`Magic packet sent to ${device.mac}`);
      setTimeout(() => setToast(null), 2600);
    } catch (e) {
      setToast(`Wake failed: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setToast(null), 3200);
    } finally {
      setWakingMac(null);
    }
  }

  return (
    <PanelShell
      manifest={manifest}
      right={
        <button
          type="button"
          onClick={scan}
          className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-surface-hi px-2.5 text-[12px] text-text transition-colors hover:text-raspberry"
        >
          <RefreshCw size={13} className={cn(scanning && "animate-spin")} />
          {scanning ? "Scanning…" : "Rescan"}
        </button>
      }
    >
      {toast && (
        <div className="mb-3 rounded-[10px] bg-[rgba(var(--raspberry-rgb),0.14)] px-3 py-2 text-[12px] text-text">
          {toast}
        </div>
      )}

      <GlassPanel interactive={false} className="overflow-hidden">
        <div className="grid grid-cols-[130px_1fr_140px_88px] items-center gap-2 border-b border-stroke px-3 py-2 text-[11px] uppercase tracking-wide text-text-dim">
          <span>IP</span>
          <span>MAC</span>
          <span>Vendor</span>
          <span className="text-right">Wake</span>
        </div>
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          {devices.map((d) => {
            const isGateway = d.ip === gatewayIp;
            return (
              <div
                key={d.mac + d.ip}
                className="grid grid-cols-[130px_1fr_140px_88px] items-center gap-2 border-b border-[rgba(255,255,255,0.03)] px-3 py-2 text-[12px] hover:bg-surface-hi"
              >
                <span className="mono flex items-center gap-1.5 text-text">
                  {isGateway && <Router size={12} className="text-raspberry" />}
                  {d.ip}
                </span>
                <span className="mono truncate text-text-dim">{d.mac}</span>
                <span className="truncate text-text-dim">{d.vendor}</span>
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
            <div className="px-3 py-6 text-center text-[13px] text-text-dim">
              No devices in the ARP cache yet. Ping something on your LAN, then rescan.
            </div>
          )}
        </div>
        <div className="border-t border-stroke px-3 py-2 text-[11px] text-text-dim">
          {devices.length} device{devices.length === 1 ? "" : "s"} discovered
        </div>
      </GlassPanel>
    </PanelShell>
  );
}

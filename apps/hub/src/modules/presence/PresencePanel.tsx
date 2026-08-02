import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  RadioTower,
  RefreshCw,
  Bell,
  BellOff,
  Trash2,
  Pencil,
  Check,
  X,
  Circle,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

/**
 * PresenceDevice — mirror of the Rust struct in `crates/core/src/presence.rs`.
 * Kept typed inline (not in @/target) because Presence is a Hub-local concern
 * — remote agents don't have their own registry yet.
 */
interface PresenceDevice {
  mac: string;
  ip: string;
  vendor: string;
  hostname: string | null;
  first_seen_ms: number;
  last_seen_ms: number;
  tag: string | null;
  alert_on: boolean;
  online: boolean;
  sighting_count: number;
}

export function PresencePanel({ manifest }: { manifest: ModuleManifest }) {
  const [devices, setDevices] = useState<PresenceDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showOffline, setShowOffline] = useState(true);
  const [newlyFlashed, setNewlyFlashed] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<PresenceDevice[]>("presence_devices");
      setDevices(list);
    } catch (e) {
      showToast(`Load failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 15s so the background scanner's writes show up without a
    // manual refresh. The scan itself runs every 5 min in Rust.
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function rescan() {
    setRescanning(true);
    try {
      const newMacs = await invoke<string[]>("presence_rescan");
      await refresh();
      if (newMacs.length > 0) {
        setNewlyFlashed(new Set(newMacs));
        showToast(
          newMacs.length === 1
            ? `New device: ${newMacs[0]}`
            : `${newMacs.length} new devices seen`,
        );
        setTimeout(() => setNewlyFlashed(new Set()), 6000);
      } else {
        showToast("Scan complete — nothing new");
      }
    } catch (e) {
      showToast(`Rescan failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRescanning(false);
    }
  }

  async function toggleAlert(d: PresenceDevice) {
    try {
      await invoke("presence_set_alert", { mac: d.mac, on: !d.alert_on });
      await refresh();
    } catch (e) {
      showToast(`Alert toggle failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function saveTag(mac: string) {
    const tag = tagDraft.trim();
    try {
      await invoke("presence_set_tag", { mac, tag: tag.length > 0 ? tag : null });
      setEditing(null);
      setTagDraft("");
      await refresh();
    } catch (e) {
      showToast(`Save tag failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function forget(d: PresenceDevice) {
    if (
      !window.confirm(
        `Forget ${d.tag ?? d.hostname ?? d.mac}? It will reappear on the next scan if it's still on the network.`,
      )
    )
      return;
    try {
      await invoke("presence_forget", { mac: d.mac });
      await refresh();
    } catch (e) {
      showToast(`Forget failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = devices;
    if (!showOffline) list = list.filter((d) => d.online);
    if (!q) return list;
    return list.filter((d) =>
      [d.ip, d.mac, d.vendor, d.hostname ?? "", d.tag ?? ""].some((f) =>
        f.toLowerCase().includes(q),
      ),
    );
  }, [devices, filter, showOffline]);

  const online = devices.filter((d) => d.online).length;
  const total = devices.length;

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="tabular-nums">
            <span className="text-emerald-300">{online}</span>
            <span className="text-white/40"> / {total} online</span>
          </span>
          <button
            onClick={rescan}
            disabled={rescanning}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium",
              "bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20",
              "disabled:opacity-50 disabled:cursor-not-allowed transition",
            )}
          >
            <RefreshCw
              size={12}
              className={cn(rescanning && "animate-spin")}
            />
            {rescanning ? "Scanning…" : "Rescan now"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by IP, MAC, vendor, hostname, or tag…"
            className={cn(
              "flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5",
              "text-sm text-white placeholder:text-white/30",
              "focus:outline-none focus:border-white/25",
            )}
          />
          <button
            onClick={() => setShowOffline((s) => !s)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs transition",
              showOffline
                ? "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                : "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200",
            )}
          >
            {showOffline ? "Showing offline" : "Online only"}
          </button>
        </div>

        <GlassPanel className="flex-1 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-white/40 text-sm">
              Loading device registry…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-white/40 text-sm">
              {devices.length === 0
                ? "No devices remembered yet. The background scanner runs every 5 minutes — or click Rescan now."
                : "No devices match your filter."}
            </div>
          ) : (
            <div className="overflow-auto h-full">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/60 backdrop-blur-sm">
                  <tr className="text-left text-xs text-white/40 border-b border-white/5">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2">Device</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">MAC</th>
                    <th className="px-3 py-2">Last seen</th>
                    <th className="px-3 py-2 text-right">Sightings</th>
                    <th className="px-3 py-2 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const flashed = newlyFlashed.has(d.mac);
                    return (
                      <tr
                        key={d.mac}
                        className={cn(
                          "border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors",
                          flashed && "bg-amber-500/[0.08]",
                        )}
                      >
                        <td className="px-3 py-2">
                          <Circle
                            size={8}
                            className={cn(
                              "fill-current",
                              d.online ? "text-emerald-400" : "text-white/20",
                            )}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {editing === d.mac ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={tagDraft}
                                onChange={(e) => setTagDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveTag(d.mac);
                                  if (e.key === "Escape") {
                                    setEditing(null);
                                    setTagDraft("");
                                  }
                                }}
                                autoFocus
                                placeholder="tag e.g. papa's phone"
                                className="rounded bg-white/10 px-2 py-0.5 text-sm text-white focus:outline-none"
                              />
                              <button
                                onClick={() => saveTag(d.mac)}
                                className="p-1 text-emerald-300 hover:text-emerald-200"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditing(null);
                                  setTagDraft("");
                                }}
                                className="p-1 text-white/40 hover:text-white"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div>
                                <div
                                  className={cn(
                                    "font-medium",
                                    d.tag ? "text-white" : "text-white/70",
                                  )}
                                >
                                  {d.tag ??
                                    d.hostname ??
                                    d.vendor ??
                                    "unknown"}
                                </div>
                                <div className="text-xs text-white/40">
                                  {d.tag && d.hostname ? d.hostname : d.vendor}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setEditing(d.mac);
                                  setTagDraft(d.tag ?? "");
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-white/70 transition"
                                title="Tag this device"
                              >
                                <Pencil size={11} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-white/60">
                          {d.ip}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-white/40">
                          {d.mac}
                        </td>
                        <td className="px-3 py-2 text-xs text-white/50">
                          {relativeTime(d.last_seen_ms)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-white/40">
                          {d.sighting_count}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => toggleAlert(d)}
                              title={
                                d.alert_on
                                  ? "Alerts on — click to disable"
                                  : "Alert me if this device reappears"
                              }
                              className={cn(
                                "p-1 rounded transition",
                                d.alert_on
                                  ? "text-amber-300 hover:text-amber-200"
                                  : "text-white/25 hover:text-white/60",
                              )}
                            >
                              {d.alert_on ? (
                                <Bell size={13} />
                              ) : (
                                <BellOff size={13} />
                              )}
                            </button>
                            <button
                              onClick={() => forget(d)}
                              title="Forget device"
                              className="p-1 rounded text-white/25 hover:text-red-300 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>

        <div className="text-xs text-white/30 shrink-0">
          <RadioTower size={11} className="inline mr-1.5" />
          Auto-rescans every 5 minutes. Tags and alert preferences persist to
          <span className="font-mono text-white/40 mx-1">%APPDATA%\Raspberry\presence.sqlite</span>
          — safe to move machines.
        </div>

        {toast && (
          <div
            className={cn(
              "absolute bottom-6 left-1/2 -translate-x-1/2",
              "rounded-md border border-white/10 bg-black/80 backdrop-blur",
              "px-4 py-2 text-sm text-white shadow-xl",
            )}
          >
            {toast}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function relativeTime(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return "just now";
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

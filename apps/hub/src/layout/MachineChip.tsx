import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Monitor, Radio, Plus, X, Check, Loader2 } from "lucide-react";
import { useAgents, LOCAL_ID, type RemoteAgent } from "@/state/useAgents";
import { probeAgent } from "@/target";
import { cn } from "@/lib/cn";

/**
 * Live health for every registered agent, refreshed every 5s. Keyed by agent id;
 * "local" is always "up". A single interval — not one per row — so N machines
 * still means one heartbeat, and switching machine doesn't reset the cadence.
 *
 * Status buckets:
 *   up       — /health responded < 1500ms ago
 *   slow     — responded but round-trip > 1200ms (agent is under load)
 *   offline  — probe failed / timed out
 *   unknown  — never probed yet (fresh add, first tick pending)
 */
type HealthStatus = "up" | "slow" | "offline" | "unknown";
interface Health {
  status: HealthStatus;
  rttMs: number | null;
  checkedAt: number | null;
  hostname?: string;
}
const HEALTH_INTERVAL_MS = 5_000;

function useAgentHealth(agents: RemoteAgent[]): Record<string, Health> {
  const [health, setHealth] = useState<Record<string, Health>>({});
  useEffect(() => {
    let cancelled = false;
    async function probeAll() {
      const entries = await Promise.all(
        agents.map(async (a) => {
          const t0 = performance.now();
          try {
            const info = await probeAgent(a.baseUrl);
            const rtt = Math.round(performance.now() - t0);
            const status: HealthStatus = rtt > 1200 ? "slow" : "up";
            return [a.id, { status, rttMs: rtt, checkedAt: Date.now(), hostname: info.hostname }] as const;
          } catch {
            return [a.id, { status: "offline" as HealthStatus, rttMs: null, checkedAt: Date.now() }] as const;
          }
        }),
      );
      if (cancelled) return;
      setHealth((prev) => {
        const next: Record<string, Health> = { ...prev };
        for (const [id, h] of entries) next[id] = h;
        return next;
      });
    }
    if (agents.length > 0) probeAll();
    const iv = window.setInterval(() => {
      if (agents.length > 0) probeAll();
    }, HEALTH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
    // Re-key by agent count + id list; new/removed agents restart the loop.
  }, [agents]);
  return health;
}

function healthRgb(status: HealthStatus): string {
  switch (status) {
    case "up":
      return "52, 211, 153";
    case "slow":
      return "251, 191, 36";
    case "offline":
      return "248, 113, 113";
    default:
      return "148, 163, 184";
  }
}

function healthLabel(h: Health | undefined): string {
  if (!h || h.status === "unknown") return "checking…";
  if (h.status === "offline") return "offline";
  if (h.status === "slow") return `${h.rttMs}ms slow`;
  return `${h.rttMs}ms`;
}

/**
 * The active-machine chip (spec §6/§8) — always visible, always the source of
 * truth for which PC you're driving. Click to open a popover: switch to any
 * registered machine, or add a new one (probes its /health endpoint before
 * saving so you get an immediate reachable/unreachable read).
 */
export function MachineChip() {
  const agents = useAgents((s) => s.agents);
  const activeId = useAgents((s) => s.activeId);
  const setActive = useAgents((s) => s.setActive);
  const removeAgent = useAgents((s) => s.removeAgent);

  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAdd(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowAdd(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const health = useAgentHealth(agents);

  const active = useMemo(() => {
    if (activeId === LOCAL_ID) return { label: "This PC", isLocal: true };
    const a = agents.find((x) => x.id === activeId);
    return { label: a?.name ?? "Unknown", isLocal: false };
  }, [activeId, agents]);

  // Active-machine dot color: raspberry when local, health-derived when remote.
  const activeHealth = activeId === LOCAL_ID ? undefined : health[activeId];
  const activeTintRgb = active.isLocal
    ? "var(--raspberry-rgb)"
    : activeHealth
      ? healthRgb(activeHealth.status)
      : "124, 58, 237"; // purple fallback while first probe is in flight

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        whileHover={{ backgroundColor: "var(--surface-hi)" }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring glass flex items-center gap-2.5 rounded-full px-3 py-1.5"
        style={{ boxShadow: `inset 0 0 0 1px rgba(${activeTintRgb}, 0.35)` }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={
          active.isLocal
            ? "This PC (local target)"
            : `${active.label} — ${healthLabel(activeHealth)}`
        }
      >
        <span className="relative flex h-2 w-2">
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: `rgba(${activeTintRgb}, 0.9)` }}
            animate={{ opacity: [0.7, 0, 0.7], scale: [1, 2.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
          <span
            className="relative h-2 w-2 rounded-full"
            style={{ background: `rgb(${activeTintRgb})` }}
          />
        </span>
        <span className="text-[12.5px] font-medium tracking-tight text-text">
          {active.label}
        </span>
        <span className="text-[11px] text-text-dim">
          {active.isLocal
            ? "local"
            : activeHealth
              ? healthLabel(activeHealth)
              : "agent"}
        </span>
        <ChevronDown size={13} className="text-text-dim" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="glass absolute left-0 top-[calc(100%+8px)] z-40 w-[320px] overflow-hidden rounded-[12px] shadow-2xl"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.06)" }}
          >
            <div className="border-b border-stroke px-3 py-2 text-[11px] uppercase tracking-wide text-text-dim">
              Machines
            </div>

            <ul role="listbox" className="max-h-[260px] overflow-y-auto">
              <MachineRow
                label="This PC"
                sub="local target"
                icon={<Monitor size={13} className="text-raspberry" />}
                active={activeId === LOCAL_ID}
                onSelect={() => {
                  setActive(LOCAL_ID);
                  setOpen(false);
                }}
              />
              {agents.map((a) => (
                <MachineRow
                  key={a.id}
                  label={a.name}
                  sub={a.baseUrl}
                  icon={<Radio size={13} className="text-purple" />}
                  active={activeId === a.id}
                  health={health[a.id]}
                  onSelect={() => {
                    setActive(a.id);
                    setOpen(false);
                  }}
                  onRemove={() => {
                    if (window.confirm(`Remove agent "${a.name}"?`)) removeAgent(a.id);
                  }}
                />
              ))}
              {agents.length === 0 && (
                <li className="px-3 py-3 text-[12px] text-text-dim">
                  No remote agents yet — add one below to monitor another PC.
                </li>
              )}
            </ul>

            <div className="border-t border-stroke bg-[rgba(255,255,255,0.02)]">
              {!showAdd ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="focus-ring flex w-full items-center gap-2 px-3 py-2.5 text-[12.5px] text-text transition-colors hover:bg-surface-hi"
                >
                  <Plus size={14} className="text-raspberry" />
                  Add machine…
                </button>
              ) : (
                <AddMachineForm
                  onDone={(added) => {
                    setShowAdd(false);
                    if (added) setOpen(false);
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MachineRow({
  label,
  sub,
  icon,
  active,
  health,
  onSelect,
  onRemove,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  active: boolean;
  health?: Health;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const dotRgb = health ? healthRgb(health.status) : null;
  const hint = health ? healthLabel(health) : undefined;
  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-surface-hi",
          active && "bg-[rgba(var(--raspberry-rgb),0.08)]",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="focus-ring flex flex-1 items-center gap-2 text-left"
          title={hint}
        >
          <span className="relative grid h-6 w-6 place-items-center rounded-[6px] bg-surface-hi">
            {icon}
            {dotRgb && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[color:var(--surface)]"
                style={{ background: `rgb(${dotRgb})` }}
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-text">{label}</span>
            <span className="mono block truncate text-[10.5px] text-text-dim">
              {sub}
            </span>
          </span>
          {hint && !active && (
            <span
              className="mono mr-1 rounded-[5px] px-1.5 py-0.5 text-[10px]"
              style={{
                color: `rgb(${dotRgb ?? "148,163,184"})`,
                background: `rgba(${dotRgb ?? "148,163,184"}, 0.1)`,
              }}
            >
              {hint}
            </span>
          )}
          {active && <Check size={13} className="text-raspberry" />}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="focus-ring grid h-6 w-6 place-items-center rounded-[5px] text-text-dim opacity-0 transition-opacity hover:bg-[rgba(255,80,80,0.15)] hover:text-red-300 group-hover:opacity-100"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </li>
  );
}

function AddMachineForm({ onDone }: { onDone: (added: boolean) => void }) {
  const addAgent = useAgents((s) => s.addAgent);
  const setActive = useAgents((s) => s.setActive);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("http://");
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "probing" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function saveAndPair() {
    setErr(null);
    setState("probing");
    try {
      const health = await probeAgent(url);
      const finalName = name.trim() || health.hostname || "Remote";
      const id = addAgent({ name: finalName, baseUrl: url.trim(), token: token.trim() });
      setActive(id);
      setState("idle");
      onDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  const canSave = url.trim().length > 8 && token.trim().length >= 8 && state !== "probing";

  return (
    <div className="space-y-2 px-3 py-3 text-[12px]">
      <div>
        <label className="mb-1 block text-[10.5px] uppercase tracking-wide text-text-dim">
          Name (optional)
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tower, Studio Mac, homelab…"
          className="focus-ring h-8 w-full rounded-[7px] bg-surface-hi px-2 text-text placeholder:text-text-dim"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10.5px] uppercase tracking-wide text-text-dim">
          Base URL
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.42:8848"
          className="focus-ring mono h-8 w-full rounded-[7px] bg-surface-hi px-2 text-text placeholder:text-text-dim"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10.5px] uppercase tracking-wide text-text-dim">
          Bearer token
        </label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste from the agent's startup log"
          className="focus-ring mono h-8 w-full rounded-[7px] bg-surface-hi px-2 text-text placeholder:text-text-dim"
        />
      </div>
      {err && (
        <div className="rounded-[6px] bg-[rgba(255,80,80,0.12)] px-2 py-1.5 text-[11px] text-red-300">
          {err}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onDone(false)}
          className="focus-ring h-8 rounded-[7px] px-3 text-text-dim hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveAndPair}
          disabled={!canSave}
          className="focus-ring ml-auto flex h-8 items-center gap-1.5 rounded-[7px] bg-[rgba(var(--raspberry-rgb),0.2)] px-3 text-raspberry disabled:opacity-40"
        >
          {state === "probing" && <Loader2 size={12} className="animate-spin" />}
          {state === "probing" ? "Probing…" : "Test & save"}
        </button>
      </div>
    </div>
  );
}

// re-export for anywhere that needs it
export type { RemoteAgent };

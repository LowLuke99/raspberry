import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAppStore } from "@/state/useAppStore";
import { cn } from "@/lib/cn";

/**
 * The active-machine chip (spec §6/§8) — always visible, always the source of
 * truth for which PC you're driving. A live pulse dot + latency, tinted by the
 * machine's accent so you never fat-finger the wrong terminal.
 */
export function MachineChip() {
  const machine = useAppStore((s) => s.activeMachine);
  const online = machine.status === "online";
  const tintVar = machine.tint === "purple" ? "--purple-rgb" : "--raspberry-rgb";

  return (
    <motion.button
      type="button"
      whileHover={{ backgroundColor: "var(--surface-hi)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
      className="focus-ring glass flex items-center gap-2.5 rounded-full px-3 py-1.5"
      style={{ boxShadow: `inset 0 0 0 1px rgba(var(${tintVar}), 0.35)` }}
      aria-label={`Active machine ${machine.hostname}, ${machine.status}, ${machine.latencyMs} milliseconds. Click to switch.`}
    >
      {/* pulse dot */}
      <span className="relative flex h-2 w-2">
        {online && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: `rgba(var(${tintVar}), 0.9)` }}
            animate={{ opacity: [0.7, 0, 0.7], scale: [1, 2.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span
          className={cn("relative h-2 w-2 rounded-full")}
          style={{
            background: online ? `rgb(var(${tintVar}))` : "var(--text-dim)",
          }}
        />
      </span>

      <span className="text-[12.5px] font-medium tracking-tight text-text">
        {machine.hostname}
      </span>
      <span className="text-[11px] text-text-dim">
        {online ? "online" : "offline"}
      </span>
      <span className="mono text-[11px] text-text-dim">
        {machine.latencyMs}ms
      </span>
      <ChevronDown size={13} className="text-text-dim" />
    </motion.button>
  );
}

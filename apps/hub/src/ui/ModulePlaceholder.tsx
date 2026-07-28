import { motion } from "framer-motion";
import type { ModuleManifest } from "@/modules/types";
import { GlassPanel } from "./GlassPanel";

/**
 * The default Phase 1 panel for every module: a calm, mostly-empty titled
 * surface. Real functionality lands in Phase 2+ — this makes the routing,
 * registry, and design system tangible without faking system data.
 */
export function ModulePlaceholder({ manifest }: { manifest: ModuleManifest }) {
  const Icon = manifest.icon;
  return (
    <div className="flex h-full w-full flex-col p-6">
      {/* Panel header — module identity. */}
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface-hi text-raspberry shadow-[var(--hairline)]">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-text">
            {manifest.label}
          </h1>
          <p className="text-[12px] text-text-dim">{manifest.description}</p>
        </div>
      </div>

      {/* Empty stage — minimalist law: detail appears in Phase 2. */}
      <GlassPanel
        interactive={false}
        className="flex flex-1 items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[rgba(var(--raspberry-rgb),0.06)] text-text-dim">
            <Icon size={28} strokeWidth={1.5} />
          </div>
          <p className="max-w-[280px] text-[13px] leading-relaxed text-text-dim">
            {manifest.label} lives here. Wiring to real data arrives in a later
            phase.
          </p>
          <span className="mono rounded-full bg-[rgba(var(--purple-rgb),0.16)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-text">
            Phase 2+
          </span>
        </motion.div>
      </GlassPanel>
    </div>
  );
}

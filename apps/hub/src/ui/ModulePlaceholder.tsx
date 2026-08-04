import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { GlassPanel } from "./GlassPanel";

/**
 * The default Phase 1 panel for every module: a calm, mostly-empty titled
 * surface. Real functionality lands in Phase 2+ — this makes the routing,
 * registry, and design system tangible without faking system data.
 */
export function ModulePlaceholder({ manifest }: { manifest: ModuleManifest }) {
  const Icon = manifest.icon;
  const [showInfo, setShowInfo] = useState(false);
  const learn = manifest.learnMore?.trim() || manifest.description;
  const paragraphs = learn.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="flex h-full w-full flex-col p-6">
      {/* Panel header — module identity. */}
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface-hi text-raspberry shadow-[var(--hairline)]">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold tracking-tight text-text">
              {manifest.label}
            </h1>
            <button
              type="button"
              onClick={() => setShowInfo((s) => !s)}
              aria-expanded={showInfo}
              aria-label="What is this?"
              title="What is this?"
              className={
                "focus-ring grid h-6 w-6 place-items-center rounded-full text-text-dim transition-colors " +
                (showInfo ? "bg-surface-hi text-raspberry" : "hover:bg-surface-hi hover:text-text")
              }
            >
              <HelpCircle size={13} strokeWidth={2} />
            </button>
          </div>
          <p className="text-[12px] text-text-dim">{manifest.description}</p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4 overflow-hidden"
          >
            <div className="glass relative flex items-start gap-3 border-l-2 border-l-raspberry/60 px-4 py-3">
              <HelpCircle size={14} className="mt-0.5 shrink-0 text-raspberry" />
              <div className="min-w-0 flex-1 space-y-2 pr-6 text-[12.5px] leading-relaxed text-text">
                <div className="text-[11px] uppercase tracking-wider text-text-dim/80">
                  What is {manifest.label}?
                </div>
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                aria-label="Hide info"
                className="focus-ring absolute right-2 top-2 rounded p-1 text-text-dim hover:text-text"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

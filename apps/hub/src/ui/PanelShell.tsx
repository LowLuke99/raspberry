import { useState, type ReactNode } from "react";
import { HelpCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ModuleManifest } from "@/modules/types";
import { target } from "@/target";

/**
 * Shared frame for a real module panel: identity header (icon + title + live/
 * sample badge), an optional right-aligned toolbar slot, and a scrollable body.
 * Keeps the four Phase 2 modules visually consistent with the placeholder.
 *
 * The header carries a "?" affordance next to the title. Clicking it slides
 * open a plain-language "What is this?" banner using `manifest.learnMore`
 * (falling back to `manifest.description`) — for anyone learning what a given
 * module actually does before poking at it.
 */
export function PanelShell({
  manifest,
  right,
  children,
}: {
  manifest: ModuleManifest;
  right?: ReactNode;
  children: ReactNode;
}) {
  const Icon = manifest.icon;
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="flex h-full w-full flex-col p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface-hi text-raspberry shadow-[var(--hairline)]">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-text">
              {manifest.label}
            </h1>
            <InfoToggle open={showInfo} onToggle={() => setShowInfo((s) => !s)} />
            <LiveBadge />
          </div>
          <p className="truncate text-[12px] text-text-dim">{manifest.description}</p>
        </div>
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
      <InfoBanner open={showInfo} manifest={manifest} onClose={() => setShowInfo(false)} />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

/** Little "?" button — click to reveal a plain-language explainer. */
function InfoToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label="What is this?"
      title="What is this?"
      className={
        "focus-ring grid h-6 w-6 place-items-center rounded-full text-text-dim transition-colors " +
        (open ? "bg-surface-hi text-raspberry" : "hover:bg-surface-hi hover:text-text")
      }
    >
      <HelpCircle size={13} strokeWidth={2} />
    </button>
  );
}

/** The slide-in "What is this?" explanation card. */
function InfoBanner({
  open,
  manifest,
  onClose,
}: {
  open: boolean;
  manifest: ModuleManifest;
  onClose: () => void;
}) {
  const body = manifest.learnMore?.trim() || manifest.description;
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="info"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mb-4 overflow-hidden"
        >
          <div className="glass relative flex items-start gap-3 border-l-2 border-l-raspberry/60 px-4 py-3">
            <HelpCircle size={14} className="mt-0.5 shrink-0 text-raspberry" />
            <div className="min-w-0 flex-1 space-y-2 pr-6 text-[12.5px] leading-relaxed text-text-dim">
              <div className="text-[11px] uppercase tracking-wider text-text-dim/80">
                What is {manifest.label}?
              </div>
              {paragraphs.map((p, i) => (
                <p key={i} className="text-text">
                  {p}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide info"
              className="focus-ring absolute right-2 top-2 rounded p-1 text-text-dim hover:text-text"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** LIVE (real data via Tauri) vs SAMPLE (mock browser preview). */
function LiveBadge() {
  const live = target.isLive;
  return (
    <span
      className="mono flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-wider"
      style={{
        background: live
          ? "rgba(var(--raspberry-rgb),0.16)"
          : "rgba(var(--purple-rgb),0.16)",
        color: "var(--text)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: live ? "rgb(var(--raspberry-rgb))" : "rgb(var(--purple-rgb))" }}
      />
      {live ? "live" : "sample"}
    </span>
  );
}

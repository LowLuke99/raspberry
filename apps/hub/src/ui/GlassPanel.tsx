import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type GlassPanelProps = HTMLMotionProps<"div"> & {
  /** Adds a raspberry glow + hairline lift on hover. Default: true. */
  interactive?: boolean;
  /** Uses the brighter `--surface-hi` fill (for raised / active surfaces). */
  raised?: boolean;
};

/**
 * The core surface primitive. Frosted glass (blur 24px), 1px hairline stroke,
 * 16px radius, soft shadow — and, when interactive, a subtle raspberry glow
 * that blooms on hover. All motion is GPU-only (transform / opacity / shadow),
 * per the Phase 1 animation rule.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    { interactive = true, raised = false, className, style, children, ...rest },
    ref,
  ) {
    return (
      <motion.div
        ref={ref}
        className={cn("glass relative overflow-hidden", className)}
        style={{
          background: raised ? "var(--surface-hi)" : undefined,
          ...style,
        }}
        // Spring on enter (spec §5: "spring on panel enter").
        initial={{ opacity: 0, y: 8, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.7 }}
        whileHover={
          interactive
            ? {
                boxShadow:
                  "inset 0 0 0 1px rgba(225,29,72,0.28), 0 0 24px rgba(225,29,72,0.22), 0 8px 40px rgba(0,0,0,0.5)",
              }
            : undefined
        }
        {...rest}
      >
        {children}
      </motion.div>
    );
  },
);

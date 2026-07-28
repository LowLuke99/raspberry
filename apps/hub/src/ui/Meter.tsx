import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface MeterProps {
  /** 0..1 fill fraction. */
  value: number;
  color?: string;
  className?: string;
}

/** A thin horizontal bar meter. The fill animates on width via a spring. */
export function Meter({ value, color = "var(--raspberry)", className }: MeterProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 220, damping: 30 }}
      />
    </div>
  );
}

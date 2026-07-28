import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type IconButtonProps = HTMLMotionProps<"button"> & {
  label: string; // accessible name (icon-only button)
  active?: boolean;
};

/**
 * Quiet, square icon button. No chrome at rest; a soft glass fill and lift
 * appear on hover/press. Used across the top bar and rail.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, active = false, className, children, ...rest }, ref) {
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        whileHover={{ backgroundColor: "var(--surface-hi)" }}
        whileTap={{ scale: 0.94 }}
        transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "focus-ring grid h-9 w-9 place-items-center rounded-[10px] text-text-dim",
          "transition-colors hover:text-text",
          active && "bg-surface-hi text-text",
          className,
        )}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);

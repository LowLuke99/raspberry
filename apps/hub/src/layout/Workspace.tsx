import { motion } from "framer-motion";
import { registry } from "@/modules/registry";
import { useAppStore } from "@/state/useAppStore";
import { useAgents } from "@/state/useAgents";

/**
 * Main workspace (spec §6). Looks up the active route in the registry and
 * renders that module's panel. Swapping modules springs the new panel in — a
 * GPU-only transform/opacity transition. If a route has no module (shouldn't
 * happen), it falls back to the first registered one.
 */
export function Workspace() {
  const activeRoute = useAppStore((s) => s.activeRoute);
  // Include the active machine id in the key so switching machines remounts
  // the current panel — every panel then refetches against the new target.
  const activeAgent = useAgents((s) => s.activeId);
  const manifest = registry.byRoute(activeRoute) ?? registry.all()[0];

  if (!manifest) {
    return (
      <div className="grid flex-1 place-items-center text-text-dim">
        No modules registered.
      </div>
    );
  }

  const Panel = manifest.Component;

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      {/*
        Keying the panel on the module id remounts it on every route change, so
        the enter animation replays and React unmounts the previous panel
        synchronously. No AnimatePresence / exit-complete dependency (which
        StrictMode can drop in dev, stranding a ghost panel in the DOM).
      */}
      <motion.div
        key={`${manifest.id}::${activeAgent}`}
        className="h-full w-full"
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.6 }}
      >
        <Panel manifest={manifest} />
      </motion.div>
    </div>
  );
}

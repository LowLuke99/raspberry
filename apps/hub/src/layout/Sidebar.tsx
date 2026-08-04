import { motion } from "framer-motion";
import { registry } from "@/modules/registry";
import type { ModuleManifest } from "@/modules/types";
import { useAppStore } from "@/state/useAppStore";
import { cn } from "@/lib/cn";

/**
 * Left icon rail (spec §6). Collapsed to pure icons; on hover the panel widens
 * and labels slide in. The panel is absolutely positioned inside a fixed-width
 * reserve, so expanding floats it over the workspace instead of reflowing the
 * whole layout. Items are generated from the registry — no hardcoded list.
 */
export function Sidebar() {
  const deck = registry.section("deck");
  const core = registry.section("core");

  return (
    <nav
      className="relative shrink-0"
      style={{ width: "var(--rail-w)" }}
      aria-label="Modules"
    >
      <div
        className="group glass absolute inset-y-0 left-0 z-20 flex w-[var(--rail-w)] flex-col gap-1 overflow-hidden rounded-2xl p-2 transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-[var(--rail-w-open)] hover:shadow-[var(--hairline),0_12px_48px_rgba(0,0,0,0.55)]"
        style={{ willChange: "width" }}
      >
        {deck.map((m) => (
          <NavItem key={m.id} manifest={m} />
        ))}

        {/* divider between the Command Deck and the tool list */}
        <div className="my-1 h-px shrink-0 bg-stroke" />

        <div className="no-scrollbar flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {core.map((m) => (
            <NavItem key={m.id} manifest={m} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({ manifest }: { manifest: ModuleManifest }) {
  const Icon = manifest.icon;
  const active = useAppStore((s) => s.activeRoute === manifest.route);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);

  return (
    <button
      type="button"
      onClick={() => setActiveRoute(manifest.route)}
      aria-current={active ? "page" : undefined}
      title={manifest.label}
      className={cn(
        "focus-ring relative flex h-10 shrink-0 items-center gap-3 rounded-[10px] px-[9px] text-left transition-colors",
        active ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
      )}
    >
      {/* active accent bar */}
      {active && (
        <motion.span
          layoutId="rail-active"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-raspberry"
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
        />
      )}
      <span className="grid w-[22px] shrink-0 place-items-center">
        <Icon size={19} strokeWidth={active ? 2 : 1.75} />
      </span>
      {/* label reveals only when the rail is expanded */}
      <span className="whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {manifest.label}
      </span>
    </button>
  );
}

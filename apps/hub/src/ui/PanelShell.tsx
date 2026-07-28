import type { ReactNode } from "react";
import type { ModuleManifest } from "@/modules/types";
import { target } from "@/target";

/**
 * Shared frame for a real module panel: identity header (icon + title + live/
 * sample badge), an optional right-aligned toolbar slot, and a scrollable body.
 * Keeps the four Phase 2 modules visually consistent with the placeholder.
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
            <LiveBadge />
          </div>
          <p className="truncate text-[12px] text-text-dim">{manifest.description}</p>
        </div>
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </div>
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

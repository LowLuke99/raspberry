import type { Target } from "./types";
import { localTarget } from "./localTarget";
import { mockTarget } from "./mockTarget";

/** True when running inside the Tauri webview (vs a plain browser). Checks every
 *  signal Tauri v2 may expose so the native app reliably reads as live. */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window ||
    "isTauri" in window
  );
}

/**
 * The active target for the local machine. Real data in the native app,
 * believable mock data in the browser preview. Phase 6 turns this into a
 * per-machine lookup so the whole app can retarget to any agent.
 */
export const target: Target = isTauri() ? localTarget : mockTarget;

export type { Target } from "./types";
export * from "./types";

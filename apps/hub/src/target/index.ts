import type { Target } from "./types";
import { localTarget } from "./localTarget";
import { mockTarget } from "./mockTarget";
import { createRemoteTarget, type RemoteAgentConn } from "./remoteTarget";

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

/** The default target for "this PC" — real in Tauri, mock in the browser. */
export const localOrMock: Target = isTauri() ? localTarget : mockTarget;

let _current: Target = localOrMock;

/**
 * The active target. Proxy over a mutable ref so panels can keep their
 * existing `import { target } from "@/target"` and every call transparently
 * hits whichever machine is currently selected — no per-panel rewiring
 * needed. Panels that want to re-fetch on machine switch subscribe via
 * `onTargetChange`; the shell also bumps a workspace key so panels remount.
 */
export const target: Target = new Proxy({} as Target, {
  get(_t, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_current as any)[prop];
  },
});

type Listener = () => void;
const listeners = new Set<Listener>();

export function setActiveTarget(next: Target): void {
  if (next === _current) return;
  _current = next;
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* subscriber threw — keep notifying the rest */
    }
  }
}

export function onTargetChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function targetForAgent(conn: RemoteAgentConn): Target {
  return createRemoteTarget(conn);
}

export type { Target } from "./types";
export type { RemoteAgentConn, AgentHealth } from "./remoteTarget";
export { probeAgent } from "./remoteTarget";
export * from "./types";

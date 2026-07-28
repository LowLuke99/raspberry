/**
 * MOCK DATA — Phase 1 only. Everything here is hardcoded and clearly fake.
 * Phase 2 replaces these with a live `Target` (LocalTarget for localhost,
 * RemoteTarget for agents). Keeping it in one file makes that swap obvious.
 */

export interface Machine {
  id: string;
  hostname: string;
  status: "online" | "offline";
  latencyMs: number;
  /** Per-machine glow tint (spec §8) so you *feel* which PC you're driving. */
  tint: "raspberry" | "purple";
}

/** The machine the whole app is currently "driving". */
export const MOCK_ACTIVE_MACHINE: Machine = {
  id: "tower-01",
  hostname: "TOWER-01",
  status: "online",
  latencyMs: 42,
  tint: "raspberry",
};

/** Bottom status-bar readout for the active machine. All faked for Phase 1. */
export const MOCK_STATUS = {
  cpu: "18%",
  gpu: "07%",
  ram: "11.4 / 32 GB",
  net: "↓ 2.1 ↑ 0.4 MB/s",
  battery: "AC",
  cwd: "C:\\Users\\luke",
  jobs: 0,
  gitBranch: "main",
} as const;

import { create } from "zustand";
import { MOCK_ACTIVE_MACHINE, type Machine } from "@/lib/mock";

/**
 * Global shell state (Zustand, spec §2). Kept deliberately small for Phase 1:
 * which module is active, whether the command palette is open, and which
 * machine we're targeting. Per-module state will live in each module's own
 * slice later — this store only owns the shell.
 */
interface AppState {
  /** Route of the module currently shown in the workspace. */
  activeRoute: string;
  setActiveRoute: (route: string) => void;

  /** Command palette (Ctrl+K) visibility. */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;

  /** The machine every module currently targets. */
  activeMachine: Machine;
  setActiveMachine: (machine: Machine) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeRoute: "/command-deck",
  setActiveRoute: (route) => set({ activeRoute: route }),

  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),

  activeMachine: MOCK_ACTIVE_MACHINE,
  setActiveMachine: (machine) => set({ activeMachine: machine }),
}));

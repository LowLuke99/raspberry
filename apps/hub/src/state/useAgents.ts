import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { localOrMock, setActiveTarget, targetForAgent } from "@/target";

/**
 * Registered remote agents (this-PC + any Raspberry Agents you've added).
 * State is persisted to localStorage so your machine list survives restarts,
 * and calling `setActive` flips the shared `target` proxy so every panel
 * transparently starts talking to the new machine.
 *
 * The "local" agent is synthetic: it's always present, always represents
 * whichever `localOrMock` target the shell resolved at startup, and can't be
 * removed.
 */
export interface RemoteAgent {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  addedAt: number;
}

interface AgentsState {
  agents: RemoteAgent[];
  activeId: string;
  addAgent: (a: Omit<RemoteAgent, "id" | "addedAt">) => string;
  removeAgent: (id: string) => void;
  setActive: (id: string) => void;
  renameAgent: (id: string, name: string) => void;
}

export const LOCAL_ID = "local";

function newId(): string {
  return `agent-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export const useAgents = create<AgentsState>()(
  persist(
    (set, get) => ({
      agents: [],
      activeId: LOCAL_ID,

      addAgent: (input) => {
        const agent: RemoteAgent = {
          ...input,
          id: newId(),
          addedAt: Date.now(),
        };
        set((s) => ({ agents: [...s.agents, agent] }));
        return agent.id;
      },

      removeAgent: (id) => {
        if (id === LOCAL_ID) return;
        set((s) => {
          const next = s.agents.filter((a) => a.id !== id);
          const activeStillExists = s.activeId === id ? LOCAL_ID : s.activeId;
          if (s.activeId === id) {
            setActiveTarget(localOrMock);
          }
          return { agents: next, activeId: activeStillExists };
        });
      },

      renameAgent: (id, name) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, name } : a)),
        })),

      setActive: (id) => {
        const { agents } = get();
        if (id === LOCAL_ID) {
          setActiveTarget(localOrMock);
          set({ activeId: LOCAL_ID });
          return;
        }
        const agent = agents.find((a) => a.id === id);
        if (!agent) return;
        setActiveTarget(targetForAgent({ baseUrl: agent.baseUrl, token: agent.token }));
        set({ activeId: id });
      },
    }),
    {
      name: "raspberry.agents.v1",
      storage: createJSONStorage(() => localStorage),
      // On rehydrate, snap the target proxy to whichever agent was last active.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.activeId === LOCAL_ID) {
          setActiveTarget(localOrMock);
          return;
        }
        const agent = state.agents.find((a) => a.id === state.activeId);
        if (agent) {
          setActiveTarget(targetForAgent({ baseUrl: agent.baseUrl, token: agent.token }));
        } else {
          // stale activeId — fall back to local
          state.activeId = LOCAL_ID;
          setActiveTarget(localOrMock);
        }
      },
    },
  ),
);

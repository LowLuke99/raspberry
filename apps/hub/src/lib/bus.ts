/**
 * Tiny typed event bus used for cross-module hand-offs — e.g. the Commands
 * panel telling the Terminal panel "paste this command and switch to me". A
 * plain EventTarget is enough; state stays owned by each module.
 */

type BusEvents = {
  /** Any module can ask the Terminal to run a command. Terminal listens. */
  "terminal:run": { command: string; execute?: boolean };
  /** Any module can ask the shell to switch the active module. */
  "nav:go": { moduleId: string };
};

class TypedBus {
  private target = new EventTarget();

  emit<K extends keyof BusEvents>(name: K, payload: BusEvents[K]): void {
    this.target.dispatchEvent(new CustomEvent(name, { detail: payload }));
  }

  on<K extends keyof BusEvents>(
    name: K,
    handler: (payload: BusEvents[K]) => void,
  ): () => void {
    const wrapped = (e: Event) => handler((e as CustomEvent<BusEvents[K]>).detail);
    this.target.addEventListener(name, wrapped);
    return () => this.target.removeEventListener(name, wrapped);
  }
}

export const bus = new TypedBus();

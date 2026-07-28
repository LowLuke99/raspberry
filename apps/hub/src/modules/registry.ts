import type { ModuleManifest } from "./types";

/**
 * The module registry (spec §12). A plain insertion-ordered map so display
 * order is deterministic. The shell reads from this singleton; modules write to
 * it at startup via `registry.register(...)`.
 */
class ModuleRegistry {
  private readonly modules = new Map<string, ModuleManifest>();

  register(manifest: ModuleManifest): void {
    if (this.modules.has(manifest.id)) {
      // Fail loud in dev — duplicate ids would silently shadow a tool.
      console.warn(`[registry] duplicate module id "${manifest.id}" ignored`);
      return;
    }
    this.modules.set(manifest.id, manifest);
  }

  registerAll(manifests: readonly ModuleManifest[]): void {
    for (const m of manifests) this.register(m);
  }

  all(): ModuleManifest[] {
    return [...this.modules.values()];
  }

  section(section: ModuleManifest["section"]): ModuleManifest[] {
    return this.all().filter((m) => m.section === section);
  }

  byRoute(route: string): ModuleManifest | undefined {
    return this.all().find((m) => m.route === route);
  }

  byId(id: string): ModuleManifest | undefined {
    return this.modules.get(id);
  }
}

export const registry = new ModuleRegistry();

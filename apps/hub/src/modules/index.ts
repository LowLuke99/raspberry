import { registry } from "./registry";
import { moduleManifests } from "./manifests";

/**
 * Bootstraps the module registry. Importing this file once (from the app entry)
 * registers every Phase 1 module before the first render. A real module folder
 * would self-register the same way — drop it in, add it here, done.
 */
registry.registerAll(moduleManifests);

export { registry };

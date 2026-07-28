import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A module's public contract (spec §12). Everything the shell needs to render a
 * tool — sidebar icon, route, command-palette entry, and the panel component —
 * comes from this manifest. The layout code never imports modules directly; it
 * only reads the registry, so new modules require zero layout edits.
 */
export interface ModuleManifest {
  /** Stable unique id, e.g. "system-monitor". */
  id: string;
  /** Human label for the sidebar and command palette. */
  label: string;
  /** Route path this module owns, e.g. "/system-monitor". */
  route: string;
  /** Sidebar / palette icon. */
  icon: LucideIcon;
  /** One-line summary shown in the placeholder and palette subtitle. */
  description: string;
  /**
   * Where the module sits in the rail. "deck" pins to the top (the Command
   * Deck centerpiece); "core" is the standard tool list.
   */
  section: "deck" | "core";
  /** The panel rendered in the main workspace when active. */
  Component: ComponentType<{ manifest: ModuleManifest }>;
  /** Extra search terms so the palette finds this by more than its label. */
  keywords?: string[];
}

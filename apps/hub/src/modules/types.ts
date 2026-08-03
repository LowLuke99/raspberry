import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Plugin manifest v2 (spec §12 + OSINT platform roadmap §3.1).
 *
 * Backwards-compatible with v1 — every field beyond `id / label / route /
 * icon / description / section / Component` is optional. Existing modules
 * keep working unchanged; new OSINT / recon plugins opt in as needed.
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
   * v1 axis (kept for sidebar pinning). `"deck"` pins to the top; `"core"` is
   * the standard tool list. New modules should ALSO set `category` below —
   * `section` remains authoritative for whether the tile lives in the deck.
   */
  section: "deck" | "core";
  /** The panel rendered in the main workspace when active. */
  Component: ComponentType<{ manifest: ModuleManifest }>;
  /** Extra search terms so the palette finds this by more than its label. */
  keywords?: string[];

  // ---- Plugin manifest v2 additions (all optional, non-breaking) ----------

  /**
   * Semver-ish plugin version. Defaults to the workspace version when omitted.
   * Used by the plugin marketplace + update notifications.
   */
  version?: string;

  /**
   * Category axis for grouping in the redesigned sidebar and for the plugin
   * marketplace filters. A module may belong to only one category.
   */
  category?: ModuleCategory;

  /**
   * What kind of work this plugin performs. Determines whether it appears in
   * the entity-typed command palette fanout (`domain X` etc.) and which
   * consent gates apply.
   */
  capabilities?: PluginCapability[];

  /**
   * Other plugin ids this plugin needs at runtime. The registry surfaces
   * missing deps in the marketplace + refuses to enable a plugin whose deps
   * are disabled.
   */
  dependencies?: string[];

  /**
   * OS-level permissions this plugin exercises. Purely descriptive today; a
   * future sandboxed plugin runtime will enforce them.
   */
  permissions?: PluginPermission[];

  /**
   * The entity types this plugin emits. Feeds the workflow engine so a node's
   * output ports are typed and the graph refuses invalid wiring.
   */
  outputSchema?: EntityKind[];

  /**
   * The entity types this plugin accepts as input. Same rationale as
   * `outputSchema`.
   */
  inputSchema?: EntityKind[];

  /**
   * Whether the plugin is on by default. Users can toggle in the Plugins
   * module. Defaults to `true` when omitted.
   */
  defaultEnabled?: boolean;

  /**
   * API-key slot names this plugin needs from the encrypted keystore. If any
   * are missing, the plugin renders a "connect API key" call-to-action
   * instead of running.
   */
  apiKeys?: ApiKeyProvider[];

  /**
   * Whether this plugin performs active recon (Nmap/Masscan/Nikto-style).
   * Active plugins force the consent gate before every run.
   */
  active?: boolean;
}

/**
 * Sidebar / marketplace groupings. Keep flat — sub-grouping happens per
 * category inside the category panel.
 */
export type ModuleCategory =
  | "system"
  | "network"
  | "osint"
  | "recon"
  | "threat-intel"
  | "web"
  | "identity"
  | "automation"
  | "reporting"
  | "utilities";

/**
 * What a plugin can do. Consumed by the command palette (only `entity-lookup`
 * plugins appear in the `domain X` fanout) and by the workflow node picker.
 */
export type PluginCapability =
  | "entity-lookup"
  | "entity-enrichment"
  | "active-recon"
  | "passive-recon"
  | "reporting"
  | "automation"
  | "system-inspection"
  | "system-control"
  | "file-analysis";

/**
 * OS / runtime permission surface. Not enforced yet — declarative for now,
 * enforced when we move to a sandboxed plugin host.
 */
export type PluginPermission =
  | "net.outbound"
  | "net.lan"
  | "fs.read"
  | "fs.write"
  | "process.spawn"
  | "process.kill"
  | "shell.execute"
  | "registry.read"
  | "registry.write"
  | "keystore.read"
  | "keystore.write";

/**
 * Typed entities that flow through the workflow engine and the entity graph.
 * Extend as new OSINT verticals ship — each new kind unlocks new node wiring.
 */
export type EntityKind =
  | "domain"
  | "subdomain"
  | "ip"
  | "cidr"
  | "email"
  | "username"
  | "url"
  | "hash-md5"
  | "hash-sha1"
  | "hash-sha256"
  | "file"
  | "asn"
  | "certificate"
  | "port"
  | "service"
  | "user-agent"
  | "phone"
  | "cve";

/**
 * Recognized API-key providers. The keystore module owns the encrypted store;
 * plugins declare which slot(s) they need and the registry surfaces missing
 * keys as a first-class UI state.
 */
export type ApiKeyProvider =
  | "shodan"
  | "censys"
  | "virustotal"
  | "abuseipdb"
  | "otx-alienvault"
  | "securitytrails"
  | "haveibeenpwned"
  | "greynoise"
  | "urlscan"
  | "hunterio"
  | "fullhunt";

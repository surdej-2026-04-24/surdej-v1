/**
 * Domain Manifest Contract
 *
 * Every frontend domain module must export a manifest conforming to this type.
 * The Vite plugin scans `src/domains/*/manifest.ts` at build time to generate the registry.
 */

export interface DomainManifest {
  /** Unique domain identifier (e.g. "my-domain", "analytics") */
  id: string;

  /** Human-readable domain name */
  name: string;

  /** Domain version (semver) */
  version: string;

  /** Commands this domain registers */
  commands: DomainCommandDefinition[];

  /** Routes this domain contributes */
  routes: DomainRouteDefinition[];

  /** Context keys this domain declares */
  contextKeys?: string[];

  /** Sidebar items this domain contributes (referenced by command ID) */
  sidebarItems?: DomainSidebarItem[];

  /** Topology IDs this domain provides (discovered from topologies/*.ts) */
  topologies?: string[];

  /** Context key expression that controls when this domain activates */
  activateOn?: string;
}

export interface DomainCommandDefinition {
  /** Command ID following namespace.group.action convention */
  id: string;

  /** Human-readable title */
  title: string;

  /** Lucide icon name */
  icon?: string;

  /** Context key expression controlling command visibility */
  when?: string;

  /** Keyboard shortcut (e.g. "mod+shift+r") */
  keybinding?: string;
}

export interface DomainRouteDefinition {
  /** Route path (e.g. "/my-domain/dashboard") */
  path: string;

  /** Command ID that navigates to this route */
  commandId: string;

  /** Lazy-loaded component path relative to the domain root */
  component: string;
}

export interface DomainSidebarItem {
  /** Command ID to execute when clicked */
  commandId: string;

  /** Display order within the sidebar group */
  order?: number;

  /** Group label (items with same group are grouped together) */
  group?: string;
}

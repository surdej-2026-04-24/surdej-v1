/**
 * Domain Manifest Contract — type-only re-export
 *
 * @see contracts/domain-manifest.d.ts
 */

export interface DomainManifest {
    id: string;
    name: string;
    version: string;
    commands: DomainCommandDefinition[];
    routes: DomainRouteDefinition[];
    contextKeys?: string[];
    sidebarItems?: DomainSidebarItem[];
    topologies?: string[];
    activateOn?: string;
}

export interface DomainCommandDefinition {
    id: string;
    title: string;
    icon?: string;
    when?: string;
    keybinding?: string;
}

export interface DomainRouteDefinition {
    path: string;
    commandId: string;
    component: string;
}

export interface DomainSidebarItem {
    commandId: string;
    order?: number;
    group?: string;
}

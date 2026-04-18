/**
 * Domain types — mirrors @surdej/core/domains
 */

export interface DomainRegistry {
    domains: Map<string, DomainRoute[]>;
    register(domainId: string, routes: DomainRoute[]): void;
    getRoutes(domainId: string): DomainRoute[];
    getAllDomains(): string[];
}

export interface DomainRoute {
    path: string;
    commandId: string;
    component: string;
    domainId: string;
}

export interface DomainTopologyRef {
    domainId: string;
    topologyId: string;
    label: string;
}

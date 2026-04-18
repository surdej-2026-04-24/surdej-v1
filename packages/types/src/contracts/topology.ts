/**
 * Topology Contract — type-only re-export
 *
 * @see contracts/topology.d.ts
 */

export interface TopologyDefinition {
    id: string;
    type: 'infrastructure' | 'codebase' | 'data-flow' | 'custom';
    name: string;
    description?: string;
    icon?: string;
    commandId: string;
    generatedAt?: string;
    generatedBy?: string;
    layers: TopologyLayer[];
    actors?: TopologyActor[];
    connections: TopologyConnection[];
}

export interface TopologyLayer {
    id: string;
    label: string;
    icon?: string;
    visible: boolean;
    nodes: TopologyNode[];
}

export interface TopologyNode {
    id: string;
    label: string;
    icon?: string;
    description: string;
    color: string;
    level: number;
    minZoomToShow?: number;
    children?: TopologyNode[];
    urls?: TopologyUrl[];
    properties?: TopologyProperty[];
    tags?: string[];
    position?: { x: number; y: number };
    size?: { width: number; height: number };
}

export interface TopologyProperty {
    key: string;
    value: string;
    icon?: string;
    copyable?: boolean;
    href?: string;
}

export interface TopologyUrl {
    label: string;
    href: string;
}

export interface TopologyActor {
    id: string;
    label: string;
    icon?: string;
    description: string;
    color: string;
    properties?: TopologyProperty[];
}

export interface TopologyConnection {
    from: string;
    to: string;
    label?: string;
    animated?: boolean;
    style?: 'solid' | 'dashed' | 'dotted';
}

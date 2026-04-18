/**
 * Topology System
 *
 * Runtime types and utilities for the topology viewer.
 * The contract types are in `contracts/topology.d.ts`.
 * This module re-exports them and adds runtime utilities.
 *
 * @module topology
 */

// Topology types — source of truth for the runtime.
// Mirrors contracts/topology.d.ts (which exists for documentation and JSON Schema generation).

/** Top-level definition — one per topology */
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

/** A layer groups related nodes — toggleable in the viewer */
export interface TopologyLayer {
    id: string;
    label: string;
    icon?: string;
    visible: boolean;
    nodes: TopologyNode[];
}

/** Recursive node — children nest infinitely */
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

/** A key-value property displayed in the property pane */
export interface TopologyProperty {
    key: string;
    value: string;
    icon?: string;
    copyable?: boolean;
    href?: string;
}

/** External link */
export interface TopologyUrl {
    label: string;
    href: string;
}

/** External entity */
export interface TopologyActor {
    id: string;
    label: string;
    icon?: string;
    description: string;
    color: string;
    properties?: TopologyProperty[];
}

/** Edge between two nodes */
export interface TopologyConnection {
    from: string;
    to: string;
    label?: string;
    animated?: boolean;
    style?: 'solid' | 'dashed' | 'dotted';
}

/**
 * Flatten all nodes from a topology definition into a flat array.
 * Useful for search, indexing, and validation.
 */
export function flattenNodes(
    layers: ReadonlyArray<{ nodes: ReadonlyArray<TopologyNodeLike> }>,
): TopologyNodeLike[] {
    const result: TopologyNodeLike[] = [];

    function walk(nodes: ReadonlyArray<TopologyNodeLike>) {
        for (const node of nodes) {
            result.push(node);
            if (node.children) {
                walk(node.children);
            }
        }
    }

    for (const layer of layers) {
        walk(layer.nodes);
    }

    return result;
}

/** Minimal shape for a topology node (for the flatten utility) */
interface TopologyNodeLike {
    id: string;
    label: string;
    children?: ReadonlyArray<TopologyNodeLike>;
}

/**
 * Find a node by ID within a topology definition.
 */
export function findNodeById(
    layers: ReadonlyArray<{ nodes: ReadonlyArray<TopologyNodeLike> }>,
    id: string,
): TopologyNodeLike | undefined {
    function search(nodes: ReadonlyArray<TopologyNodeLike>): TopologyNodeLike | undefined {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = search(node.children);
                if (found) return found;
            }
        }
        return undefined;
    }

    for (const layer of layers) {
        const found = search(layer.nodes);
        if (found) return found;
    }

    return undefined;
}

/**
 * Get the breadcrumb path (ancestor chain) for a node by ID.
 */
export function getNodeBreadcrumb(
    layers: ReadonlyArray<{ id: string; label: string; nodes: ReadonlyArray<TopologyNodeLike> }>,
    nodeId: string,
): Array<{ id: string; label: string }> {
    function search(
        nodes: ReadonlyArray<TopologyNodeLike>,
        path: Array<{ id: string; label: string }>,
    ): Array<{ id: string; label: string }> | null {
        for (const node of nodes) {
            const currentPath = [...path, { id: node.id, label: node.label }];
            if (node.id === nodeId) return currentPath;
            if (node.children) {
                const found = search(node.children, currentPath);
                if (found) return found;
            }
        }
        return null;
    }

    for (const layer of layers) {
        const found = search(layer.nodes, [{ id: layer.id, label: layer.label }]);
        if (found) return found;
    }

    return [];
}

/**
 * Count all nodes across all layers.
 */
export function countNodes(
    layers: ReadonlyArray<{ nodes: ReadonlyArray<TopologyNodeLike> }>,
): number {
    return flattenNodes(layers).length;
}

/**
 * Validate a topology definition for common issues.
 */
export function validateTopology(
    topology: {
        id: string;
        layers: ReadonlyArray<{ nodes: ReadonlyArray<TopologyNodeLike> }>;
        connections: ReadonlyArray<{ from: string; to: string }>;
        actors?: ReadonlyArray<{ id: string }>;
    },
): string[] {
    const errors: string[] = [];
    const allNodes = flattenNodes(topology.layers);
    const nodeIds = new Set(allNodes.map((n) => n.id));
    const actorIds = new Set((topology.actors ?? []).map((a) => a.id));
    const allIds = new Set([...nodeIds, ...actorIds]);

    // Check for duplicate node IDs
    const seenIds = new Set<string>();
    for (const node of allNodes) {
        if (seenIds.has(node.id)) {
            errors.push(`Duplicate node ID: "${node.id}"`);
        }
        seenIds.add(node.id);
    }

    // Check connections reference valid nodes
    for (const conn of topology.connections) {
        if (!allIds.has(conn.from)) {
            errors.push(`Connection references unknown source: "${conn.from}"`);
        }
        if (!allIds.has(conn.to)) {
            errors.push(`Connection references unknown target: "${conn.to}"`);
        }
    }

    return errors;
}

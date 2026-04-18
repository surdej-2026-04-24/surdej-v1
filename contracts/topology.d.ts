/**
 * Topology Contract
 *
 * A topology is a declarative graph that describes infrastructure, code structure,
 * or data flow. The data is generated (by CLI scanners) or hand-authored.
 * The core platform provides a Google Maps-like viewer with two view modes.
 */

/** Top-level definition — one per topology ("architecture", "codebase", etc.) */
export interface TopologyDefinition {
    /** Unique topology ID (e.g. "my-architecture", "analytics-codebase") */
    id: string;

    /** Topology type — the viewer applies type-specific defaults */
    type: 'infrastructure' | 'codebase' | 'data-flow' | 'custom';

    /** Human-readable name */
    name: string;

    /** Description shown in the topology hub */
    description?: string;

    /** Lucide icon name */
    icon?: string;

    /** Auto-registered navigable command ID */
    commandId: string;

    /** ISO timestamp — set by CLI generator */
    generatedAt?: string;

    /** Generator that produced this topology (e.g. "cli:topology:infra" or "manual") */
    generatedBy?: string;

    /** Toggleable layers (like Google Maps layers) */
    layers: TopologyLayer[];

    /** External entities that interact with the system (Developer, End User, Bot) */
    actors?: TopologyActor[];

    /** Edges between nodes */
    connections: TopologyConnection[];
}

/** A layer groups related nodes — toggleable in the viewer (like map layers) */
export interface TopologyLayer {
    /** Layer identifier (e.g. "dev", "prod", "packages", "workers") */
    id: string;

    /** Human-readable label */
    label: string;

    /** Lucide icon name */
    icon?: string;

    /** Default visibility when the topology loads */
    visible: boolean;

    /** Top-level nodes in this layer */
    nodes: TopologyNode[];
}

/** Recursive node — children nest infinitely */
export interface TopologyNode {
    /** Unique node ID */
    id: string;

    /** Display label */
    label: string;

    /** Lucide icon name */
    icon?: string;

    /** Node description */
    description: string;

    /** Tailwind gradient classes for node background */
    color: string;

    /** Nesting depth (0 = top-level) */
    level: number;

    /** Only render in map view above this zoom level */
    minZoomToShow?: number;

    /** Nested sub-nodes */
    children?: TopologyNode[];

    /** External URLs shown in the property pane */
    urls?: TopologyUrl[];

    /** Structured key-value properties shown in the property pane */
    properties?: TopologyProperty[];

    /** Searchable/filterable tags */
    tags?: string[];

    /** Layout hint — auto-layout engine fills this if omitted */
    position?: { x: number; y: number };

    /** Size hint — auto-layout engine fills this if omitted */
    size?: { width: number; height: number };
}

/** A key-value property displayed in the property pane */
export interface TopologyProperty {
    /** Property key (e.g. "Runtime", "Port", "Language") */
    key: string;

    /** Property value (e.g. "Node.js 22", "5001", "TypeScript") */
    value: string;

    /** Lucide icon name */
    icon?: string;

    /** Show copy button */
    copyable?: boolean;

    /** Make value a link */
    href?: string;
}

/** External link */
export interface TopologyUrl {
    /** Link label */
    label: string;

    /** Link URL */
    href: string;
}

/** External entity that interacts with the system */
export interface TopologyActor {
    /** Unique actor ID */
    id: string;

    /** Display label */
    label: string;

    /** Lucide icon name */
    icon?: string;

    /** Actor description */
    description: string;

    /** Tailwind gradient classes */
    color: string;

    /** Structured properties shown in the property pane */
    properties?: TopologyProperty[];
}

/** Edge between two nodes */
export interface TopologyConnection {
    /** Source node ID */
    from: string;

    /** Target node ID */
    to: string;

    /** Edge label (e.g. "HTTPS", "NATS", "CI/CD") */
    label?: string;

    /** Animated dash line */
    animated?: boolean;

    /** Line style */
    style?: 'solid' | 'dashed' | 'dotted';
}

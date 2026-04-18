import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    ChevronRight, ChevronDown, ChevronLeft, PanelLeftClose, PanelRightClose,
    Layers, Eye, EyeOff, X, Copy, ExternalLink, ArrowLeft, ArrowRight,
    Network, Code2, GitBranch, Server, Database, Monitor, Radio, Shield,
    Cloud, Package, Wrench, FolderGit2, User, Users, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_TOPOLOGIES } from '@/core/topology/demo-data';
import type {
    TopologyDefinition,
    TopologyNode,
    TopologyLayer,
    TopologyProperty,
    TopologyActor,
    TopologyConnection,
} from '@surdej/core';
import { flattenNodes, getNodeBreadcrumb } from '@surdej/core';

// Icon mapping from string names to Lucide components
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Network, Code2, GitBranch, Server, Database, Monitor, Radio, Shield,
    Cloud, Package, Wrench, FolderGit2, User, Users, Layers, Rocket,
};

function getIcon(name?: string): React.FC<{ className?: string }> | null {
    if (!name) return null;
    return ICON_MAP[name] ?? null;
}

function stripNodePrefix(id: string): string {
    return id.replace(/^(actor-|docker-|app-|k8s-|pkg-)/, '');
}

export function TopologyViewerPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const topology = useMemo(
        () => DEMO_TOPOLOGIES.find((t) => t.id === id),
        [id],
    );

    const [explorerOpen, setExplorerOpen] = useState(true);
    const [propertyPaneOpen, setPropertyPaneOpen] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(() =>
        topology ? Object.fromEntries(topology.layers.map((l) => [l.id, l.visible])) : {},
    );

    const allNodes = useMemo(
        () => (topology ? flattenNodes(topology.layers) : []),
        [topology],
    );

    const selectedNode = useMemo(
        () => {
            if (!selectedNodeId || !topology) return null;
            // Search in nodes
            for (const layer of topology.layers) {
                const found = findInNodes(layer.nodes, selectedNodeId);
                if (found) return { type: 'node' as const, data: found };
            }
            // Search in actors
            const actor = topology.actors?.find((a) => a.id === selectedNodeId);
            if (actor) return { type: 'actor' as const, data: actor };
            return null;
        },
        [selectedNodeId, topology],
    );

    const breadcrumb = useMemo(
        () => {
            if (!selectedNodeId || !topology) return [];
            return getNodeBreadcrumb(topology.layers, selectedNodeId);
        },
        [selectedNodeId, topology],
    );

    const handleSelectNode = useCallback((nodeId: string) => {
        setSelectedNodeId(nodeId);
        setPropertyPaneOpen(true);
    }, []);

    const toggleLayer = useCallback((layerId: string) => {
        setLayerVisibility((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
    }, []);

    if (!topology) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="text-5xl mb-4">🗺️</div>
                <h1 className="text-2xl font-bold mb-2">Topology not found</h1>
                <p className="text-sm text-muted-foreground mb-4">No topology with ID "{id}"</p>
                <Button variant="secondary" onClick={() => navigate('/topology')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Hub
                </Button>
            </div>
        );
    }

    const visibleLayers = topology.layers.filter((l) => layerVisibility[l.id] !== false);
    const visibleNodes = flattenNodes(visibleLayers);

    return (
        <div className="flex flex-col h-full -m-6 animate-fade-in">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/topology')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Back to hub</TooltipContent>
                </Tooltip>
                <Separator orientation="vertical" className="h-5" />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={explorerOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setExplorerOpen(!explorerOpen)}
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{explorerOpen ? 'Hide' : 'Show'} explorer</TooltipContent>
                </Tooltip>

                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate">{topology.name}</span>
                    <div className="flex gap-1">
                        {topology.layers.map((layer) => {
                            const visible = layerVisibility[layer.id] !== false;
                            const LayerIcon = getIcon(layer.icon);
                            return (
                                <Tooltip key={layer.id}>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={visible ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className={cn('h-6 text-[10px] gap-1 px-2', !visible && 'opacity-50')}
                                            onClick={() => toggleLayer(layer.id)}
                                        >
                                            {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                            {layer.label}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{visible ? 'Hide' : 'Show'} {layer.label} layer</TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={propertyPaneOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPropertyPaneOpen(!propertyPaneOpen)}
                        >
                            <PanelRightClose className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{propertyPaneOpen ? 'Hide' : 'Show'} properties</TooltipContent>
                </Tooltip>
            </div>

            {/* Main content: Explorer | Canvas | Properties */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Explorer pane */}
                {explorerOpen && (
                    <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0 overflow-hidden">
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
                            Explorer
                        </div>
                        <div className="flex-1 overflow-y-auto py-1">
                            {/* Actors */}
                            {topology.actors && topology.actors.length > 0 && (
                                <ExplorerSection title="Actors">
                                    {topology.actors.map((actor) => (
                                        <ExplorerLeaf
                                            key={actor.id}
                                            label={actor.label}
                                            icon={actor.icon}
                                            color={actor.color}
                                            selected={selectedNodeId === actor.id}
                                            onClick={() => handleSelectNode(actor.id)}
                                        />
                                    ))}
                                </ExplorerSection>
                            )}
                            {/* Layers */}
                            {topology.layers.map((layer) => {
                                const visible = layerVisibility[layer.id] !== false;
                                return (
                                    <ExplorerSection
                                        key={layer.id}
                                        title={layer.label}
                                        dimmed={!visible}
                                    >
                                        {layer.nodes.map((node) => (
                                            <ExplorerTreeNode
                                                key={node.id}
                                                node={node}
                                                selectedId={selectedNodeId}
                                                onSelect={handleSelectNode}
                                                depth={0}
                                            />
                                        ))}
                                    </ExplorerSection>
                                );
                            })}
                        </div>
                        {/* Explorer footer */}
                        <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground">
                            {visibleNodes.length} nodes · {topology.connections.length} connections
                        </div>
                    </div>
                )}

                {/* Canvas area */}
                <div className="flex-1 bg-muted/10 relative overflow-auto">
                    <TopologyCanvas
                        topology={topology}
                        visibleLayers={visibleLayers}
                        selectedNodeId={selectedNodeId}
                        onSelectNode={handleSelectNode}
                    />
                </div>

                {/* Property pane */}
                {propertyPaneOpen && selectedNode && (
                    <div className="w-80 border-l bg-background flex flex-col shrink-0 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPropertyPaneOpen(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <PropertyPane
                                item={selectedNode}
                                breadcrumb={breadcrumb}
                                connections={topology.connections}
                                onSelectNode={handleSelectNode}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-1.5 border-t text-[10px] text-muted-foreground bg-background shrink-0">
                <span>
                    {allNodes.length} total nodes · {topology.connections.length} connections · {topology.layers.length} layers
                </span>
                <span>
                    {visibleLayers.length}/{topology.layers.length} layers visible
                </span>
            </div>
        </div>
    );
}

/* ─── Explorer Components ─── */

function ExplorerSection({ title, dimmed, children }: { title: string; dimmed?: boolean; children: React.ReactNode }) {
    const [expanded, setExpanded] = useState(true);
    return (
        <div className={cn(dimmed && 'opacity-40')}>
            <button
                className="flex items-center gap-1 w-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {title}
            </button>
            {expanded && <div className="pl-1">{children}</div>}
        </div>
    );
}

function ExplorerTreeNode({
    node,
    selectedId,
    onSelect,
    depth,
}: {
    node: TopologyNode;
    selectedId: string | null;
    onSelect: (id: string) => void;
    depth: number;
}) {
    const [expanded, setExpanded] = useState(depth < 1);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div>
            <button
                className={cn(
                    'flex items-center gap-1.5 w-full text-left text-xs py-1 pr-2 rounded-sm transition-colors',
                    selectedId === node.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted/60 text-foreground/80',
                )}
                style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
                onClick={() => {
                    onSelect(node.id);
                    if (hasChildren) setExpanded(!expanded);
                }}
            >
                {hasChildren ? (
                    expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                    <span className="w-3 shrink-0" />
                )}
                <NodeIcon name={node.icon} color={node.color} size="sm" />
                <span className="truncate">{node.label}</span>
            </button>
            {expanded && hasChildren && node.children!.map((child) => (
                <ExplorerTreeNode
                    key={child.id}
                    node={child}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    depth={depth + 1}
                />
            ))}
        </div>
    );
}

function ExplorerLeaf({
    label,
    icon,
    color,
    selected,
    onClick,
}: {
    label: string;
    icon?: string;
    color: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            className={cn(
                'flex items-center gap-1.5 w-full text-left text-xs py-1 pl-6 pr-2 rounded-sm transition-colors',
                selected
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted/60 text-foreground/80',
            )}
            onClick={onClick}
        >
            <NodeIcon name={icon} color={color} size="sm" />
            <span className="truncate">{label}</span>
        </button>
    );
}

/* ─── Canvas (simplified visual graph) ─── */

function TopologyCanvas({
    topology,
    visibleLayers,
    selectedNodeId,
    onSelectNode,
}: {
    topology: TopologyDefinition;
    visibleLayers: TopologyLayer[];
    selectedNodeId: string | null;
    onSelectNode: (id: string) => void;
}) {
    return (
        <div className="p-6 space-y-8">
            {/* Actors */}
            {topology.actors && topology.actors.length > 0 && (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actors</div>
                    <div className="flex gap-3 flex-wrap">
                        {topology.actors.map((actor) => (
                            <CanvasCard
                                key={actor.id}
                                id={actor.id}
                                label={actor.label}
                                description={actor.description}
                                icon={actor.icon}
                                color={actor.color}
                                selected={selectedNodeId === actor.id}
                                onClick={() => onSelectNode(actor.id)}
                                variant="actor"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Layers */}
            {visibleLayers.map((layer) => (
                <div key={layer.id}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <LayerIcon name={layer.icon} />
                        {layer.label}
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        {layer.nodes.map((node) => (
                            <CanvasNodeGroup
                                key={node.id}
                                node={node}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={onSelectNode}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {/* Connections legend */}
            {topology.connections.length > 0 && (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Connections</div>
                    <div className="flex flex-wrap gap-2">
                        {topology.connections.map((conn, i) => (
                            <Badge
                                key={i}
                                variant="outline"
                                className={cn(
                                    'text-[10px] gap-1 cursor-pointer transition-all hover:bg-muted',
                                    (selectedNodeId === conn.from || selectedNodeId === conn.to) && 'ring-1 ring-primary bg-primary/5',
                                )}
                                onClick={() => onSelectNode(conn.from)}
                            >
                                <span className="truncate max-w-[80px]">{stripNodePrefix(conn.from)}</span>
                                <ArrowRight className="h-2.5 w-2.5" />
                                <span className="truncate max-w-[80px]">{stripNodePrefix(conn.to)}</span>
                                {conn.label && <span className="text-muted-foreground">({conn.label})</span>}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function CanvasNodeGroup({
    node,
    selectedNodeId,
    onSelectNode,
}: {
    node: TopologyNode;
    selectedNodeId: string | null;
    onSelectNode: (id: string) => void;
}) {
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className={cn(
            hasChildren && 'rounded-xl border border-dashed border-muted-foreground/20 p-3 bg-muted/20',
        )}>
            <CanvasCard
                id={node.id}
                label={node.label}
                description={node.description}
                icon={node.icon}
                color={node.color}
                selected={selectedNodeId === node.id}
                onClick={() => onSelectNode(node.id)}
                tags={node.tags}
            />
            {hasChildren && (
                <div className="flex gap-3 mt-3 flex-wrap">
                    {node.children!.map((child) => (
                        <CanvasNodeGroup
                            key={child.id}
                            node={child}
                            selectedNodeId={selectedNodeId}
                            onSelectNode={onSelectNode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function CanvasCard({
    id,
    label,
    description,
    icon,
    color,
    selected,
    onClick,
    variant,
    tags,
}: {
    id: string;
    label: string;
    description: string;
    icon?: string;
    color: string;
    selected: boolean;
    onClick: () => void;
    variant?: 'actor';
    tags?: string[];
}) {
    return (
        <button
            className={cn(
                'text-left rounded-xl border p-4 transition-all duration-200 min-w-[180px] max-w-[240px]',
                'hover:shadow-md hover:-translate-y-0.5',
                variant === 'actor' ? 'border-dashed' : 'bg-card',
                selected ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : 'hover:border-primary/30',
            )}
            onClick={onClick}
        >
            <div className="flex items-center gap-2.5 mb-2">
                <NodeIcon name={icon} color={color} size="md" />
                <span className="font-semibold text-sm">{label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
            {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </button>
    );
}

/* ─── Property Pane ─── */

function PropertyPane({
    item,
    breadcrumb,
    connections,
    onSelectNode,
}: {
    item: { type: 'node'; data: TopologyNode } | { type: 'actor'; data: TopologyActor };
    breadcrumb: Array<{ id: string; label: string }>;
    connections: TopologyConnection[];
    onSelectNode: (id: string) => void;
}) {
    const data = item.data;
    const properties = data.properties ?? [];
    const isNode = item.type === 'node';
    const node = isNode ? (data as TopologyNode) : null;
    const nodeConnections = isNode
        ? connections.filter((c) => c.from === data.id || c.to === data.id)
        : [];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <NodeIcon name={data.icon} color={data.color} size="lg" />
                <div>
                    <div className="font-semibold">{data.label}</div>
                    <div className="text-xs text-muted-foreground">{item.type === 'actor' ? 'Actor' : 'Node'}</div>
                </div>
            </div>

            {/* Breadcrumb */}
            {breadcrumb.length > 1 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                    {breadcrumb.map((b, i) => (
                        <span key={b.id} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="h-2.5 w-2.5" />}
                            <span className={cn(i === breadcrumb.length - 1 && 'text-foreground font-medium')}>
                                {b.label}
                            </span>
                        </span>
                    ))}
                </div>
            )}

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed">{data.description}</p>

            <Separator />

            {/* Properties */}
            {properties.length > 0 && (
                <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</div>
                    <div className="space-y-1.5">
                        {properties.map((prop) => (
                            <PropertyRow key={prop.key} property={prop} />
                        ))}
                    </div>
                </div>
            )}

            {/* Tags */}
            {node?.tags && node.tags.length > 0 && (
                <>
                    <Separator />
                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</div>
                        <div className="flex flex-wrap gap-1.5">
                            {node.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* URLs */}
            {node?.urls && node.urls.length > 0 && (
                <>
                    <Separator />
                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Links</div>
                        {node.urls.map((url) => (
                            <a
                                key={url.href}
                                href={url.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-primary hover:underline"
                            >
                                <ExternalLink className="h-3 w-3" />
                                {url.label}
                            </a>
                        ))}
                    </div>
                </>
            )}

            {/* Children count */}
            {node?.children && node.children.length > 0 && (
                <>
                    <Separator />
                    <div className="text-[10px] text-muted-foreground">
                        {node.children.length} child node{node.children.length > 1 ? 's' : ''}
                    </div>
                </>
            )}

            {/* Connections */}
            {isNode && (
                <>
                    <Separator />
                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Connections</div>
                        {nodeConnections.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No connections for this node.</p>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {nodeConnections.map((conn) => {
                                    const otherId = conn.from === data.id ? conn.to : conn.from;
                                    return (
                                        <Badge
                                            key={`${conn.from}-${conn.to}`}
                                            variant="outline"
                                            className="text-[10px] gap-1 cursor-pointer transition-all hover:bg-muted justify-start w-full"
                                            onClick={() => onSelectNode(otherId)}
                                        >
                                            <span className="truncate max-w-[80px]">{stripNodePrefix(conn.from)}</span>
                                            <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate max-w-[80px]">{stripNodePrefix(conn.to)}</span>
                                            {conn.label && <span className="text-muted-foreground shrink-0">({conn.label})</span>}
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function PropertyRow({ property }: { property: TopologyProperty }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(property.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex items-center justify-between gap-2 group">
            <div className="text-xs text-muted-foreground">{property.key}</div>
            <div className="flex items-center gap-1">
                {property.href ? (
                    <a href={property.href} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {property.value}
                    </a>
                ) : (
                    <span className="text-xs font-mono">{property.value}</span>
                )}
                {property.copyable && (
                    <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <span className="text-[9px] text-green-500">✓</span>
                        ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

/* ─── Shared ─── */

function NodeIcon({ name, color, size }: { name?: string; color: string; size: 'sm' | 'md' | 'lg' }) {
    const Icon = getIcon(name);
    const sizeClasses = {
        sm: 'w-5 h-5 rounded',
        md: 'w-8 h-8 rounded-lg',
        lg: 'w-10 h-10 rounded-xl',
    };
    const iconClasses = {
        sm: 'h-3 w-3',
        md: 'h-4 w-4',
        lg: 'h-5 w-5',
    };

    return (
        <div className={cn(`bg-gradient-to-br ${color} flex items-center justify-center shadow-sm shrink-0`, sizeClasses[size])}>
            {Icon ? <Icon className={cn('text-white', iconClasses[size])} /> : <span className="text-white text-[8px]">?</span>}
        </div>
    );
}

function LayerIcon({ name }: { name?: string }) {
    const Icon = getIcon(name);
    if (!Icon) return null;
    return <Icon className="h-3 w-3" />;
}

/* ─── Helpers ─── */

function findInNodes(nodes: TopologyNode[], id: string): TopologyNode | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findInNodes(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

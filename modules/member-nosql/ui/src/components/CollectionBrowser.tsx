import { useState, useEffect, useCallback } from 'react';
import type { Collection } from '@surdej/module-member-nosql-shared';
import { useNosqlApi } from '../hooks/useNosqlApi.js';

interface CollectionBrowserProps {
    tenantId?: string;
    selectedId?: string | null;
    onSelect: (collection: Collection) => void;
    onCreateRequest?: (parentId?: string) => void;
}

interface TreeNode extends Collection {
    children: TreeNode[];
}

function CollectionNode({
    node,
    depth,
    selectedId,
    onSelect,
    onCreateRequest,
}: {
    node: TreeNode;
    depth: number;
    selectedId?: string | null;
    onSelect: (c: Collection) => void;
    onCreateRequest?: (parentId?: string) => void;
}) {
    const [expanded, setExpanded] = useState(depth === 0);
    const isSelected = node.id === selectedId;
    const hasChildren = node.children.length > 0;

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 8px',
                    paddingLeft: 8 + depth * 18,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent, #f3f4f6)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                }}
                onClick={() => onSelect(node)}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(p => !p); }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: 'var(--muted-foreground, #6b7280)' }}
                    >
                        {expanded ? '▾' : '▸'}
                    </button>
                ) : (
                    <span style={{ width: 14 }} />
                )}
                <span style={{ fontSize: 14 }}>📁</span>
                <span style={{ fontSize: 13, flex: 1 }}>{node.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)' }}>
                    {node._count?.documents ?? 0}
                </span>
            </div>

            {expanded && hasChildren && (
                <div>
                    {node.children.map(child => (
                        <CollectionNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onCreateRequest={onCreateRequest}
                        />
                    ))}
                </div>
            )}

            {expanded && onCreateRequest && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        paddingLeft: 8 + (depth + 1) * 18 + 14,
                        cursor: 'pointer',
                        opacity: 0.5,
                        fontSize: 12,
                        color: 'var(--muted-foreground, #6b7280)',
                    }}
                    onClick={() => onCreateRequest(node.id)}
                >
                    + New sub-collection
                </div>
            )}
        </div>
    );
}

export function CollectionBrowser({ tenantId, selectedId, onSelect, onCreateRequest }: CollectionBrowserProps) {
    const api = useNosqlApi();
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getCollectionTree(tenantId);
            setTree(data as TreeNode[]);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div style={{ padding: 16, fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>Loading collections…</div>;
    if (error) return <div style={{ padding: 16, fontSize: 13, color: '#ef4444' }}>Error: {error}</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 8px 4px' }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground, #6b7280)' }}>
                    Collections
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                    {onCreateRequest && (
                        <button
                            onClick={() => onCreateRequest()}
                            title="New root collection"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted-foreground, #6b7280)' }}
                        >
                            +
                        </button>
                    )}
                    <button
                        onClick={load}
                        title="Refresh"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}
                    >
                        ↻
                    </button>
                </div>
            </div>

            {tree.length === 0 ? (
                <div style={{ padding: '12px 8px', fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>
                    No collections yet.
                </div>
            ) : (
                tree.map(node => (
                    <CollectionNode
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        onCreateRequest={onCreateRequest}
                    />
                ))
            )}
        </div>
    );
}

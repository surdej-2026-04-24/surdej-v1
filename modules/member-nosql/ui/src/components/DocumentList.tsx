import { useState, useEffect, useCallback } from 'react';
import type { Document } from '@surdej/module-member-nosql-shared';
import { useNosqlApi } from '../hooks/useNosqlApi.js';

interface DocumentListProps {
    collectionId: string;
    collectionName?: string;
    onSelect: (doc: Document) => void;
    onCreateRequest?: () => void;
    getDocumentHref?: (doc: Document) => string;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-DK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function getDocumentTitle(doc: Document): string {
    const data = doc.data as Record<string, unknown>;
    const candidates = ['name', 'title', 'companyName', 'firstName', 'label', 'id'];
    for (const key of candidates) {
        if (data[key] && typeof data[key] === 'string') {
            const val = data[key] as string;
            if (data['lastName']) return `${val} ${data['lastName']}`;
            return val;
        }
    }
    return doc.id.slice(0, 8) + '…';
}

function getDocumentSubtitle(doc: Document): string {
    const data = doc.data as Record<string, unknown>;
    const candidates = ['role', 'email', 'industry', 'category', 'status', 'url'];
    for (const key of candidates) {
        if (data[key] && typeof data[key] === 'string') return data[key] as string;
    }
    return '';
}

export function DocumentList({ collectionId, collectionName, onSelect, onCreateRequest, getDocumentHref }: DocumentListProps) {
    const api = useNosqlApi();
    const [docs, setDocs] = useState<Document[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const limit = 50;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.listDocuments(collectionId, { limit, offset, includeDeleted });
            setDocs(res.items);
            setTotal(res.total);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [collectionId, limit, offset, includeDeleted]);

    useEffect(() => {
        setOffset(0);
        setDocs([]);
    }, [collectionId]);

    useEffect(() => { load(); }, [load]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderBottom: '1px solid var(--border, #e5e7eb)',
            }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {collectionName ?? 'Documents'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)' }}>
                    {total} total
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input type="checkbox" checked={includeDeleted} onChange={e => setIncludeDeleted(e.target.checked)} />
                        Show deleted
                    </label>
                    <button onClick={load} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', background: 'none', cursor: 'pointer' }}>
                        Refresh
                    </button>
                    {onCreateRequest && (
                        <button
                            onClick={onCreateRequest}
                            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary, #3b82f6)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
                        >
                            + New
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {loading && (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground, #6b7280)', fontSize: 13 }}>
                        Loading…
                    </div>
                )}
                {error && (
                    <div style={{ padding: 16, color: '#ef4444', fontSize: 13 }}>Error: {error}</div>
                )}
                {!loading && docs.length === 0 && (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground, #6b7280)', fontSize: 13 }}>
                        No documents found.
                    </div>
                )}
                {docs.map(doc => {
                    const Tag = getDocumentHref ? 'a' : 'div';
                    const linkProps = getDocumentHref
                        ? { href: getDocumentHref(doc), onClick: (e: React.MouseEvent) => { e.preventDefault(); onSelect(doc); } }
                        : { onClick: () => onSelect(doc) };
                    return (
                        <Tag
                            key={doc.id}
                            {...linkProps}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 12,
                                padding: '10px 16px',
                                borderBottom: '1px solid var(--border, #f3f4f6)',
                                cursor: 'pointer',
                                opacity: doc.deletedAt ? 0.5 : 1,
                                textDecoration: 'none',
                                color: 'inherit',
                            }}
                            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent, #f9fafb)')}
                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 500, fontSize: 13 }}>{getDocumentTitle(doc)}</span>
                                    {doc.deletedAt && (
                                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: '#fee2e2', color: '#ef4444' }}>
                                            deleted
                                        </span>
                                    )}
                                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--accent, #f3f4f6)', color: 'var(--muted-foreground, #6b7280)' }}>
                                        v{doc.version}
                                    </span>
                                </div>
                                {getDocumentSubtitle(doc) && (
                                    <div style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', marginTop: 1 }}>
                                        {getDocumentSubtitle(doc)}
                                    </div>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {formatDate(doc.updatedAt)}
                            </div>
                        </Tag>
                    );
                })}
            </div>

            {/* Pagination */}
            {total > limit && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12, borderTop: '1px solid var(--border, #e5e7eb)' }}>
                    <button
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                        style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', cursor: offset === 0 ? 'not-allowed' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}
                    >
                        ← Prev
                    </button>
                    <span style={{ fontSize: 12, padding: '4px 0', color: 'var(--muted-foreground, #6b7280)' }}>
                        {offset + 1}–{Math.min(offset + limit, total)} of {total}
                    </span>
                    <button
                        disabled={offset + limit >= total}
                        onClick={() => setOffset(offset + limit)}
                        style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', cursor: offset + limit >= total ? 'not-allowed' : 'pointer', opacity: offset + limit >= total ? 0.5 : 1 }}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

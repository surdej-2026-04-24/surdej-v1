/**
 * RunbookList — Card grid of all runbooks
 *
 * Groups by prefix (surdej-* vs red-*) with search, filter, and
 * quick actions (view flyer, edit, delete).
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, Printer, FileText, Search, Filter, Plus, Download } from 'lucide-react';
import type { Runbook, RunbookListResponse } from '@surdej/module-member-runbook-shared';
import { useRunbookApi } from '../hooks/useRunbookApi.js';

interface RunbookListProps {
    onSelect?: (runbook: Runbook) => void;
    onCreateNew?: () => void;
}

export function RunbookList({ onSelect, onCreateNew }: RunbookListProps) {
    const api = useRunbookApi();
    const [data, setData] = useState<RunbookListResponse | null>(null);
    const [search, setSearch] = useState('');
    const [prefixFilter, setPrefixFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await api.listRunbooks({
                search: search || undefined,
                prefix: prefixFilter || undefined,
            });
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [search, prefixFilter]);

    const handleImport = async () => {
        setImporting(true);
        try {
            const result = await api.importFromAgents();
            alert(`Imported ${result.imported.length} runbooks, skipped ${result.skipped.length}`);
            fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setImporting(false);
        }
    };

    const openFlyer = (runbook: Runbook) => {
        const url = api.getFlyerUrl(runbook.id);
        window.open(url, '_blank');
    };

    const prefixColor = (prefix: string) => {
        switch (prefix) {
            case 'surdej': return { bg: '#6C7A65', text: 'white' };
            case 'red': return { bg: '#e63946', text: 'white' };
            default: return { bg: '#888', text: 'white' };
        }
    };

    const statusBadge = (status: string) => {
        const colors: Record<string, { bg: string; text: string }> = {
            draft: { bg: '#fef3c7', text: '#92400e' },
            published: { bg: '#d1fae5', text: '#065f46' },
            archived: { bg: '#f3f4f6', text: '#6b7280' },
        };
        return colors[status] || colors.draft;
    };

    // Group runbooks by prefix
    const grouped = (data?.items || []).reduce<Record<string, Runbook[]>>((acc, r) => {
        const key = r.prefix;
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
    }, {});

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: '#1C1A18' }}>
                        <BookOpen style={{ display: 'inline', width: '28px', height: '28px', marginRight: '8px', verticalAlign: 'text-bottom' }} />
                        Runbooks
                    </h1>
                    <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                        AI workflow prompts — /surdej (platform)
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleImport}
                        disabled={importing}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', border: '1px solid #ddd',
                            background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        <Download size={14} />
                        {importing ? 'Importerer...' : 'Import fra .surdej/agents'}
                    </button>
                    {onCreateNew && (
                        <button
                            onClick={onCreateNew}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: 'none',
                                background: '#6C7A65', color: 'white', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            <Plus size={14} />
                            Ny Runbook
                        </button>
                    )}
                </div>
            </div>

            {/* Search & Filter */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                        type="text"
                        placeholder="Søg i runbooks..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px',
                            border: '1px solid #ddd', fontSize: '14px', outline: 'none',
                        }}
                    />
                </div>
                <select
                    value={prefixFilter}
                    onChange={e => setPrefixFilter(e.target.value)}
                    style={{
                        padding: '10px 16px', borderRadius: '8px', border: '1px solid #ddd',
                        fontSize: '14px', background: 'white', cursor: 'pointer',
                    }}
                >
                    <option value="">Alle prefixes</option>
                    <option value="surdej">/surdej-* (Platform)</option>
                </select>
            </div>

            {/* Error */}
            {error && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '16px' }}>
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>Indlæser runbooks...</p>}

            {/* Grouped Cards */}
            {!loading && Object.entries(grouped).map(([prefix, runbooks]) => (
                <div key={prefix} style={{ marginBottom: '32px' }}>
                    <h2 style={{
                        fontSize: '16px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                        textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666',
                        marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
                            fontSize: '12px', fontWeight: 700,
                            background: prefixColor(prefix).bg, color: prefixColor(prefix).text,
                        }}>
                            /{prefix}
                        </span>
                        {prefix === 'surdej' ? 'Platform Workflows' : prefix}
                        <span style={{ fontSize: '12px', fontWeight: 400, color: '#999' }}>({runbooks.length})</span>
                    </h2>

                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px',
                    }}>
                        {runbooks.map(rb => (
                            <div
                                key={rb.id}
                                onClick={() => onSelect?.(rb)}
                                style={{
                                    background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb',
                                    padding: '20px', cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                }}
                                onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                                onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <code style={{ fontSize: '14px', fontWeight: 700, color: prefixColor(rb.prefix).bg }}>
                                        /{rb.slug}
                                    </code>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                                        background: statusBadge(rb.status).bg, color: statusBadge(rb.status).text,
                                    }}>
                                        {rb.status}
                                    </span>
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1C1A18', marginBottom: '4px' }}>
                                    {rb.title}
                                </h3>
                                {rb.description && (
                                    <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5, marginBottom: '12px' }}>
                                        {rb.description.slice(0, 120)}{rb.description.length > 120 ? '...' : ''}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                    {rb.tags.map(tag => (
                                        <span key={tag} style={{
                                            fontSize: '11px', padding: '2px 8px', borderRadius: '8px',
                                            background: '#f3f4f6', color: '#374151',
                                        }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                                    <button
                                        onClick={e => { e.stopPropagation(); openFlyer(rb); }}
                                        style={{
                                            padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd',
                                            background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                        }}
                                    >
                                        <Printer size={12} /> Print Flyer
                                    </button>
                                    <button
                                        onClick={e => { e.stopPropagation(); onSelect?.(rb); }}
                                        style={{
                                            padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd',
                                            background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                        }}
                                    >
                                        <FileText size={12} /> Se Indhold
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Empty state */}
            {!loading && (!data || data.total === 0) && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <BookOpen size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                    <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Ingen runbooks endnu</p>
                    <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                        Import fra <code>.surdej/agents/workflows/</code> eller opret en ny.
                    </p>
                    <button
                        onClick={handleImport}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: 'none',
                            background: '#6C7A65', color: 'white', cursor: 'pointer',
                            fontSize: '14px', fontWeight: 600,
                        }}
                    >
                        <Download size={14} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                        Import fra .surdej/agents
                    </button>
                </div>
            )}
        </div>
    );
}

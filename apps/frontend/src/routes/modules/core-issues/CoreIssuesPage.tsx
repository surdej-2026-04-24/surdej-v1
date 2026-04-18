/**
 * Core Issues Module — Frontend integration page
 * Routes: /modules/core-issues, /modules/core-issues/:issueId
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { IssueList, IssueDetail, IssueForm, LabelManager } from '@surdej/module-core-issues-ui';

type View = 'list' | 'detail' | 'create' | 'labels';

export function CoreIssuesPage() {
    const { issueId } = useParams<{ issueId?: string }>();
    const navigate = useNavigate();
    const [view, setView] = useState<View>(issueId ? 'detail' : 'list');
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(issueId ?? null);

    // Sync URL param
    useEffect(() => {
        if (issueId && issueId !== selectedIssueId) {
            setSelectedIssueId(issueId);
            setView('detail');
        }
    }, [issueId]);

    const handleSelect = useCallback((id: string) => {
        setSelectedIssueId(id);
        setView('detail');
        navigate(`/modules/core-issues/${id}`, { replace: true });
    }, [navigate]);

    const handleBack = useCallback(() => {
        setView('list');
        setSelectedIssueId(null);
        navigate('/modules/core-issues', { replace: true });
    }, [navigate]);

    const handleCreate = useCallback(() => {
        setView('create');
    }, []);

    const handleCreated = useCallback(() => {
        setView('list');
        navigate('/modules/core-issues', { replace: true });
    }, [navigate]);

    const handleLabels = useCallback(() => {
        setView('labels');
    }, []);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top bar */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                }}>
                    📋
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Issues</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Intern issue-tracker med labels, tildeling og historik
                    </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {view !== 'list' && (
                        <button
                            onClick={handleBack}
                            style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: '1px solid var(--border, #d1d5db)',
                                background: 'var(--background, #fff)',
                                fontSize: 12, cursor: 'pointer',
                            }}
                        >
                            ← Oversigt
                        </button>
                    )}
                    {view !== 'labels' && (
                        <button
                            onClick={handleLabels}
                            style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: '1px solid var(--border, #d1d5db)',
                                background: 'var(--background, #fff)',
                                fontSize: 12, cursor: 'pointer',
                            }}
                        >
                            🏷️ Labels
                        </button>
                    )}
                    {view !== 'create' && (
                        <button
                            onClick={handleCreate}
                            style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: 'none',
                                background: 'var(--primary, #6366f1)',
                                color: '#fff',
                                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            }}
                        >
                            + Ny Issue
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {view === 'list' && (
                    <div style={{ flex: 1 }}>
                        <IssueList onSelect={handleSelect} />
                    </div>
                )}

                {view === 'detail' && selectedIssueId && (
                    <div style={{ flex: 1 }}>
                        <IssueDetail issueId={selectedIssueId} onBack={handleBack} />
                    </div>
                )}

                {view === 'create' && (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <IssueForm onCreated={handleCreated} />
                    </div>
                )}

                {view === 'labels' && (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <LabelManager onClose={handleBack} />
                    </div>
                )}
            </div>
        </div>
    );
}

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AdminDashboard } from '@surdej/module-member-nosql-ui';

export function NosqlAdminPage() {
    const navigate = useNavigate();

    const handleSelectCollection = useCallback((collectionId: string) => {
        navigate(`/modules/nosql/collections/${collectionId}`);
    }, [navigate]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top bar */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                }}>
                    🗄️
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>NoSQL Store</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Collections, documents &amp; version history
                    </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => navigate('/modules/nosql/collections')}
                        style={{
                            padding: '6px 14px', borderRadius: 6,
                            border: 'none',
                            background: 'var(--primary, #6366f1)',
                            color: '#fff',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        }}
                    >
                        Browse Collections
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
                <AdminDashboard onSelectCollection={handleSelectCollection} />
            </div>
        </div>
    );
}

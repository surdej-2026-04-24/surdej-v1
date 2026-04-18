/**
 * FlyerPreview — Live preview of a runbook flyer
 *
 * Opens the flyer in an iframe or new tab with layout selection.
 */

import React, { useState, useEffect } from 'react';
import { Printer, ExternalLink, Layout, ChevronDown } from 'lucide-react';
import type { Runbook, FlyerLayout } from '@surdej/module-member-runbook-shared';
import { useRunbookApi } from '../hooks/useRunbookApi.js';

interface FlyerPreviewProps {
    runbook: Runbook;
    onClose?: () => void;
}

export function FlyerPreview({ runbook, onClose }: FlyerPreviewProps) {
    const api = useRunbookApi();
    const [layouts, setLayouts] = useState<FlyerLayout[]>([]);
    const [selectedLayout, setSelectedLayout] = useState<string | undefined>(
        runbook.flyerLayoutId || undefined
    );
    const [showLayoutSelect, setShowLayoutSelect] = useState(false);

    useEffect(() => {
        api.listLayouts().then(res => setLayouts(res.items));
    }, []);

    const flyerUrl = api.getFlyerUrl(runbook.id, selectedLayout);

    const handlePrint = () => {
        window.open(flyerUrl, '_blank');
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{
                background: 'white', borderRadius: '16px', width: '90vw', maxWidth: '1200px',
                height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                            <Printer size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                            Flyer: /{runbook.slug}
                        </h2>
                        <p style={{ fontSize: '13px', color: '#666' }}>{runbook.title}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Layout selector */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowLayoutSelect(!showLayoutSelect)}
                                style={{
                                    padding: '8px 14px', borderRadius: '8px', border: '1px solid #ddd',
                                    background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                }}
                            >
                                <Layout size={14} />
                                Layout
                                <ChevronDown size={12} />
                            </button>
                            {showLayoutSelect && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                    background: 'white', borderRadius: '8px', border: '1px solid #ddd',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '250px', zIndex: 10,
                                    overflow: 'hidden',
                                }}>
                                    {layouts.map(layout => (
                                        <button
                                            key={layout.id}
                                            onClick={() => { setSelectedLayout(layout.id); setShowLayoutSelect(false); }}
                                            style={{
                                                display: 'block', width: '100%', padding: '10px 16px',
                                                textAlign: 'left', border: 'none', cursor: 'pointer',
                                                background: selectedLayout === layout.id ? '#f3f4f6' : 'white',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, color: '#1C1A18' }}>{layout.name}</div>
                                            {layout.businessUnit && (
                                                <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                                                    {layout.businessUnit}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handlePrint}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: 'none',
                                background: '#6C7A65', color: 'white', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            <ExternalLink size={14} />
                            Åbn & Print
                        </button>

                        {onClose && (
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd',
                                    background: 'white', cursor: 'pointer', fontSize: '16px',
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Preview iframe */}
                <div style={{ flex: 1, background: '#e0e0e0', overflow: 'auto' }}>
                    <iframe
                        src={flyerUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title={`Flyer preview: ${runbook.slug}`}
                    />
                </div>
            </div>
        </div>
    );
}

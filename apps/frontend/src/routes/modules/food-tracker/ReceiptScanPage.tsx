import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
    ScanLine, Upload, Camera, Loader2, CheckCircle2, ArrowLeft, Plus, Trash2, RefreshCw, AlertCircle,
} from 'lucide-react';
import {
    loadFridgeItems, saveFridgeItems, CATEGORY_OPTIONS, type FridgeItem,
} from './fridgeStore';

// ─── AI receipt parsing ────────────────────────────────────────────────────────
// Sends the image to the backend /api/ai/scan-receipt endpoint which uses
// GPT-4o vision to extract ALL items from the receipt with their prices.
// Expiry dates are intentionally omitted — receipts do not carry that info.

interface ParsedReceiptItem {
    name: string;
    quantity: string;
    price: string | null;     // price as read from the receipt line (e.g. "29.95")
    category: string;
}

async function scanReceiptImage(file: File): Promise<ParsedReceiptItem[]> {
    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(',');
            if (!result.startsWith('data:') || commaIdx === -1) {
                reject(new Error('FileReader produced an unexpected result format'));
                return;
            }
            resolve(result.slice(commaIdx + 1));
        };
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });

    const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        throw new Error(err.error ?? `Scan failed: ${res.status}`);
    }

    const data = await res.json() as { items?: ParsedReceiptItem[] };
    return data.items ?? [];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'scanning' | 'review' | 'done';

interface ReviewItem extends ParsedReceiptItem {
    id: string;
    selected: boolean;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4,
    padding: '6px 10px', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 6, fontSize: 12, background: 'var(--background, #fff)',
    color: 'var(--foreground, #111)', boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: 'var(--primary, #6366f1)', color: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
};

const secondaryBtnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 6,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'transparent', color: 'var(--foreground, #111)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReceiptScanPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('upload');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
    const [addedCount, setAddedCount] = useState(0);
    const [scanError, setScanError] = useState<string | null>(null);

    const processFile = useCallback(async (file: File) => {
        setPreviewUrl(URL.createObjectURL(file));
        setStep('scanning');
        setScanError(null);

        try {
            const parsed = await scanReceiptImage(file);
            if (parsed.length === 0) {
                setScanError('Ingen varer fundet på kvitteringen. Prøv et klarere billede, eller tilføj varer manuelt.');
            }
            setReviewItems(parsed.map(p => ({ ...p, id: crypto.randomUUID(), selected: true })));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setScanError(`Scanning fejlede: ${msg}. Du kan tilføje varer manuelt.`);
            setReviewItems([]);
        }

        setStep('review');
    }, []);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file);
    }, [processFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        processFile(file);
    }, [processFile]);

    const toggleItem = useCallback((id: string) => {
        setReviewItems(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
    }, []);

    const removeItem = useCallback((id: string) => {
        setReviewItems(prev => prev.filter(r => r.id !== id));
    }, []);

    const updateField = useCallback(<K extends keyof ReviewItem>(id: string, key: K, value: ReviewItem[K]) => {
        setReviewItems(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
    }, []);

    const handleImport = useCallback(() => {
        const existing = loadFridgeItems();
        const toAdd: FridgeItem[] = reviewItems
            .filter(r => r.selected && r.name.trim())
            .map(r => ({
                id: crypto.randomUUID(),
                name: r.name,
                quantity: r.quantity,
                price: r.price || null,
                category: r.category,
                purchasedAt: new Date().toISOString().slice(0, 10),
                expiresAt: null, // Receipts do not carry expiry date information
                opened: false,
                openedAt: null,
            }));
        saveFridgeItems([...existing, ...toAdd]);
        setAddedCount(toAdd.length);
        setStep('done');
    }, [reviewItems]);

    const handleReset = useCallback(() => {
        setStep('upload');
        setPreviewUrl(null);
        setReviewItems([]);
        setScanError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    }, []);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
                <button
                    onClick={() => navigate('/modules/food-tracker')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground, #6b7280)', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                    <ArrowLeft size={18} />
                </button>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <ScanLine size={20} color="#fff" />
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Scan Kvittering</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Upload en kvittering og tilføj varer automatisk til køleskabet
                    </p>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {/* ── Step: Upload ── */}
                {step === 'upload' && (
                    <div style={{ maxWidth: 560, margin: '0 auto' }}>
                        {/* Camera capture button (prominent on mobile) */}
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            style={{
                                ...primaryBtnStyle,
                                width: '100%', justifyContent: 'center',
                                padding: '14px 20px', fontSize: 15, borderRadius: 10,
                                marginBottom: 16,
                            }}
                        >
                            <Camera size={18} /> Tag billede med kamera
                        </button>

                        <div
                            onDrop={handleDrop}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border, #e5e7eb)',
                                borderRadius: 12, padding: '40px',
                                textAlign: 'center', cursor: 'pointer',
                                transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary, #6366f1)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)')}
                        >
                            <Upload size={32} style={{ margin: '0 auto 12px', color: 'var(--muted-foreground, #9ca3af)' }} />
                            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>
                                Træk og slip en kvittering hertil
                            </p>
                            <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: '0 0 16px' }}>
                                — eller klik for at vælge en fil (JPEG, PNG, PDF)
                            </p>
                            <button style={primaryBtnStyle}>
                                <Upload size={14} /> Vælg fil
                            </button>
                        </div>
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />

                        <div style={{ marginTop: 24, padding: 16, borderRadius: 10, background: 'var(--muted, #f9fafb)', border: '1px solid var(--border, #e5e7eb)' }}>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>💡 Sådan virker det</p>
                            <ol style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                                <li>Upload et billede af din kvittering</li>
                                <li>AI scanner og identificerer ALLE varer og priser</li>
                                <li>Gennemse og rediger listen før import</li>
                                <li>Varerne tilføjes automatisk til køleskabet</li>
                            </ol>
                            <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: '8px 0 0' }}>
                                ℹ️ Udløbsdatoer hentes ikke fra kvitteringen — tilføj dem manuelt via "Scan udløbsdato".
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Step: Scanning ── */}
                {step === 'scanning' && (
                    <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
                        {previewUrl && (
                            <img
                                src={previewUrl}
                                alt="Kvittering"
                                style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, marginBottom: 24, opacity: 0.7 }}
                            />
                        )}
                        <Loader2 size={40} style={{ margin: '0 auto 16px', color: 'var(--primary, #6366f1)', animation: 'spin 1s linear infinite' }} />
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Analyserer kvittering…</p>
                        <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                            AI scanner og identificerer alle varer og priser. Et øjeblik…
                        </p>
                    </div>
                )}

                {/* ── Step: Review ── */}
                {step === 'review' && (
                    <div style={{ maxWidth: 860, margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>
                                    {reviewItems.filter(r => r.selected).length} varer fundet
                                </p>
                                <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                                    Gennemse og rediger listen inden du importerer til køleskabet.
                                </p>
                            </div>
                            <button onClick={handleReset} style={secondaryBtnStyle}>
                                <RefreshCw size={13} /> Start forfra
                            </button>
                        </div>

                        {/* Error / warning banner */}
                        {scanError && (
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: 12, borderRadius: 8, marginBottom: 12,
                                background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e',
                            }}>
                                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span style={{ fontSize: 13 }}>{scanError}</span>
                            </div>
                        )}

                        {/* Column headers */}
                        {reviewItems.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '24px 2fr 1fr 1fr 1.5fr 28px', gap: 8, padding: '0 4px 6px', borderBottom: '1px solid var(--border, #e5e7eb)', marginBottom: 6 }}>
                                <span />
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Varenavn</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Antal</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pris</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kategori</span>
                                <span />
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {reviewItems.map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        padding: '8px 4px', borderRadius: 8,
                                        border: `1px solid ${item.selected ? 'var(--primary, #6366f1)' : 'var(--border, #e5e7eb)'}`,
                                        background: item.selected ? 'color-mix(in srgb, var(--primary, #6366f1) 5%, transparent)' : 'var(--muted, #f9fafb)',
                                        opacity: item.selected ? 1 : 0.5,
                                    }}
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: '24px 2fr 1fr 1fr 1.5fr 28px', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={item.selected}
                                            onChange={() => toggleItem(item.id)}
                                            style={{ cursor: 'pointer', flexShrink: 0 }}
                                        />
                                        <input
                                            value={item.name}
                                            onChange={e => updateField(item.id, 'name', e.target.value)}
                                            disabled={!item.selected}
                                            style={inputStyle}
                                            placeholder="Varenavn"
                                        />
                                        <input
                                            value={item.quantity}
                                            onChange={e => updateField(item.id, 'quantity', e.target.value)}
                                            disabled={!item.selected}
                                            style={inputStyle}
                                            placeholder="Antal"
                                        />
                                        <input
                                            value={item.price ?? ''}
                                            onChange={e => updateField(item.id, 'price', e.target.value || null)}
                                            disabled={!item.selected}
                                            style={inputStyle}
                                            placeholder="Pris"
                                        />
                                        <select
                                            value={item.category}
                                            onChange={e => updateField(item.id, 'category', e.target.value)}
                                            disabled={!item.selected}
                                            style={inputStyle}
                                        >
                                            {CATEGORY_OPTIONS.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground, #6b7280)', padding: 4, flexShrink: 0 }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => setReviewItems(prev => [...prev, {
                                    id: crypto.randomUUID(),
                                    name: '', quantity: '1', price: null, category: 'Andet', selected: true,
                                }])}
                                style={{ ...secondaryBtnStyle, justifyContent: 'center', marginTop: 4 }}
                            >
                                <Plus size={14} /> Tilføj vare manuelt
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button onClick={handleReset} style={secondaryBtnStyle}>Annuller</button>
                            <button
                                onClick={handleImport}
                                disabled={reviewItems.filter(r => r.selected).length === 0}
                                style={{ ...primaryBtnStyle, opacity: reviewItems.filter(r => r.selected).length > 0 ? 1 : 0.4 }}
                            >
                                <Plus size={14} /> Tilføj {reviewItems.filter(r => r.selected).length} vare{reviewItems.filter(r => r.selected).length !== 1 ? 'r' : ''} til køleskabet
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step: Done ── */}
                {step === 'done' && (
                    <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
                        <CheckCircle2 size={56} style={{ margin: '0 auto 16px', color: '#10b981' }} />
                        <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
                            {addedCount} vare{addedCount !== 1 ? 'r' : ''} tilføjet!
                        </p>
                        <p style={{ fontSize: 14, color: 'var(--muted-foreground, #6b7280)', margin: '0 0 24px' }}>
                            Varerne er nu registreret i dit digitale køleskab.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button onClick={handleReset} style={secondaryBtnStyle}>
                                <ScanLine size={14} /> Scan endnu en
                            </button>
                            <button onClick={() => navigate('/modules/food-tracker')} style={primaryBtnStyle}>
                                Se køleskabet
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

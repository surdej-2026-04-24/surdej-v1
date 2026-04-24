import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
    Camera, Upload, Loader2, CheckCircle2, ArrowLeft, Plus, Trash2, RefreshCw,
} from 'lucide-react';
import {
    loadFridgeItems, saveFridgeItems, CATEGORY_OPTIONS, type FridgeItem,
} from './fridgeStore';
import { fileToBase64 } from './scanUtils';

// ─── AI expiry date parsing ────────────────────────────────────────────────────

interface ParsedExpiryItem {
    name: string;
    quantity: string;
    category: string;
    expiryDate: string | null; // ISO date read from the product label
}

const EXPIRY_PROMPT = `Du er en udløbsdato-scanner. Se på dette billede af én eller flere dagligvarer og udtræk produktnavne og udløbsdatoer.
Returner KUN et gyldigt JSON array uden yderligere tekst. Hvert element skal have:
- "name": produktnavn (string)
- "quantity": mængde/antal f.eks. "1 stk", "500g" (string)
- "category": én af: "Mejeri", "Kød & Fisk", "Grøntsager & Frugt", "Drikkevarer", "Brød & Bagværk", "Frost", "Kolonial", "Hygiejne & Rengøring", "Andet"
- "expiryDate": udløbsdatoen præcis som den er angivet på etiketten, konverteret til YYYY-MM-DD format, eller null hvis ikke synlig

Eksempel: [{"name":"Minimælk 1 L","quantity":"1 stk","category":"Mejeri","expiryDate":"2025-05-01"}]`;

async function scanExpiryWithAI(file: File): Promise<ParsedExpiryItem[]> {
    const imageBase64 = await fileToBase64(file);

    const res = await fetch('/api/module/core-openai/image-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            imageBase64,
            imageMimeType: file.type || 'image/jpeg',
            prompt: EXPIRY_PROMPT,
            model: 'gpt-4o',
            maxTokens: 2048,
        }),
    });

    if (!res.ok) {
        throw new Error(`AI analyse fejlede: ${res.status}`);
    }

    const data = await res.json() as { description: string };
    const text = data.description.trim();

    // Extract JSON array from the response (handle markdown code blocks if present)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
        const items = JSON.parse(jsonMatch[0]) as ParsedExpiryItem[];
        return Array.isArray(items) ? items : [];
    } catch {
        throw new Error('AI returnerede ugyldigt format. Prøv igen.');
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'scanning' | 'review' | 'done' | 'error';

interface ReviewItem extends ParsedExpiryItem {
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

export function ExpiryDateScanPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('upload');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
    const [addedCount, setAddedCount] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const processFile = useCallback(async (file: File) => {
        setPreviewUrl(URL.createObjectURL(file));
        setStep('scanning');
        setErrorMessage(null);
        try {
            const parsed = await scanExpiryWithAI(file);
            setReviewItems(parsed.map(p => ({ ...p, id: crypto.randomUUID(), selected: true })));
            setStep('review');
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Ukendt fejl');
            setStep('error');
        }
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
                category: r.category,
                purchasedAt: new Date().toISOString().slice(0, 10),
                expiresAt: r.expiryDate,
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
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Camera size={20} color="#fff" />
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Scan Udløbsdato</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Tag et billede af dine varer — AI aflæser udløbsdatoerne automatisk
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

                        {/* File upload drop zone */}
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
                            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>
                                Træk og slip et billede hertil
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: '0 0 14px' }}>
                                — eller klik for at vælge fra galleriet (JPEG, PNG)
                            </p>
                            <button style={{ ...secondaryBtnStyle, margin: '0 auto' }}>
                                <Upload size={14} /> Vælg fil
                            </button>
                        </div>

                        {/* Hidden inputs */}
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
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />

                        <div style={{ marginTop: 24, padding: 16, borderRadius: 10, background: 'var(--muted, #f9fafb)', border: '1px solid var(--border, #e5e7eb)' }}>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>💡 Sådan virker det</p>
                            <ol style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                                <li>Tag et billede af dine varer efter en indkøbstur</li>
                                <li>AI scanner og aflæser udløbsdatoerne fra etiketterne</li>
                                <li>Gennemse og rediger listen før import</li>
                                <li>Varerne tilføjes som uåbnede i køleskabet</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* ── Step: Scanning ── */}
                {step === 'scanning' && (
                    <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
                        {previewUrl && (
                            <img
                                src={previewUrl}
                                alt="Produktbillede"
                                style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, marginBottom: 24, opacity: 0.7 }}
                            />
                        )}
                        <Loader2 size={40} style={{ margin: '0 auto 16px', color: 'var(--primary, #6366f1)', animation: 'spin 1s linear infinite' }} />
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Aflæser udløbsdatoer…</p>
                        <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                            AI scanner produkterne og finder udløbsdatoerne. Et øjeblik…
                        </p>
                    </div>
                )}

                {/* ── Step: Review ── */}
                {step === 'review' && (
                    <div style={{ maxWidth: 760, margin: '0 auto' }}>
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {reviewItems.map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        padding: 12, borderRadius: 8,
                                        border: `1px solid ${item.selected ? 'var(--primary, #6366f1)' : 'var(--border, #e5e7eb)'}`,
                                        background: item.selected ? 'color-mix(in srgb, var(--primary, #6366f1) 5%, transparent)' : 'var(--muted, #f9fafb)',
                                        opacity: item.selected ? 1 : 0.5,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <input
                                            type="checkbox"
                                            checked={item.selected}
                                            onChange={() => toggleItem(item.id)}
                                            style={{ marginTop: 3, cursor: 'pointer', flexShrink: 0 }}
                                        />
                                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
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
                                            <input
                                                type="date"
                                                value={item.expiryDate ?? ''}
                                                onChange={e => updateField(item.id, 'expiryDate', e.target.value || null)}
                                                disabled={!item.selected}
                                                style={inputStyle}
                                                title="Udløbsdato"
                                            />
                                        </div>
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
                                    name: '', quantity: '1', category: 'Andet', expiryDate: null, selected: true,
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
                            Varerne er tilføjet som uåbnede i dit digitale køleskab.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button onClick={handleReset} style={secondaryBtnStyle}>
                                <Camera size={14} /> Scan endnu et billede
                            </button>
                            <button onClick={() => navigate('/modules/food-tracker')} style={primaryBtnStyle}>
                                Se køleskabet
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step: Error ── */}
                {step === 'error' && (
                    <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
                        <p style={{ fontSize: 40, margin: '0 auto 16px' }}>⚠️</p>
                        <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Scanning fejlede</p>
                        <p style={{ fontSize: 14, color: 'var(--muted-foreground, #6b7280)', margin: '0 0 24px' }}>
                            {errorMessage ?? 'Kunne ikke analysere billedet. Prøv igen med et tydeligere billede.'}
                        </p>
                        <button onClick={handleReset} style={primaryBtnStyle}>
                            <RefreshCw size={14} /> Prøv igen
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

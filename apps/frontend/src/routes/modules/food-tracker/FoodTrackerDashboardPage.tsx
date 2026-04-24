import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
    Refrigerator, ScanLine, ChefHat, Plus, Trash2, CheckSquare, Square,
    AlertTriangle, Clock, CheckCircle2, HelpCircle, Search, X, Camera,
} from 'lucide-react';
import {
    loadFridgeItems, saveFridgeItems, getExpiryStatus, daysUntilExpiry,
    CATEGORY_OPTIONS, PRODUCT_SUGGESTIONS, type FridgeItem, type ExpiryStatus,
} from './fridgeStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: ExpiryStatus, expiresAt: string | null) {
    if (status === 'expired') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                background: '#fee2e2', color: '#dc2626',
            }}>
                <AlertTriangle size={11} />
                Udløbet
            </span>
        );
    }
    if (status === 'expiring-soon') {
        const days = expiresAt ? daysUntilExpiry(expiresAt) : 0;
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                background: '#fef3c7', color: '#d97706',
            }}>
                <Clock size={11} />
                {days === 0 ? 'Udløber i dag' : `${days} dag${days === 1 ? '' : 'e'} tilbage`}
            </span>
        );
    }
    if (status === 'ok' && expiresAt) {
        const days = daysUntilExpiry(expiresAt);
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12,
                background: '#dcfce7', color: '#16a34a',
            }}>
                <CheckCircle2 size={11} />
                {days} dag{days === 1 ? '' : 'e'}
            </span>
        );
    }
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12,
            background: '#f3f4f6', color: '#6b7280',
        }}>
            <HelpCircle size={11} />
            Ukendt
        </span>
    );
}

function newItem(overrides: Partial<FridgeItem> = {}): FridgeItem {
    return {
        id: crypto.randomUUID(),
        name: '',
        quantity: '1',
        price: null,
        category: 'Andet',
        purchasedAt: new Date().toISOString().slice(0, 10),
        expiresAt: null,
        opened: false,
        openedAt: null,
        ...overrides,
    };
}

// ─── Add Item Modal ────────────────────────────────────────────────────────────

interface AddItemModalProps {
    initial?: Partial<FridgeItem>;
    onSave: (item: FridgeItem) => void;
    onCancel: () => void;
}

function AddItemModal({ initial, onSave, onCancel }: AddItemModalProps) {
    const [form, setForm] = useState<FridgeItem>(() => newItem(initial));
    const [suggestions, setSuggestions] = useState<typeof PRODUCT_SUGGESTIONS>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    // Allow onMouseDown on suggestion buttons to fire before onBlur hides the list
    const SUGGESTION_HIDE_DELAY_MS = 150;

    const set = <K extends keyof FridgeItem>(key: K, value: FridgeItem[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const handleNameChange = (value: string) => {
        set('name', value);
        if (value.trim()) {
            const q = value.toLowerCase();
            const matches = PRODUCT_SUGGESTIONS.filter(p =>
                p.name.toLowerCase().includes(q)
            ).slice(0, 8);
            setSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const applySuggestion = (p: typeof PRODUCT_SUGGESTIONS[number]) => {
        setForm(prev => ({ ...prev, name: p.name, quantity: p.quantity, category: p.category }));
        setSuggestions([]);
        setShowSuggestions(false);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: 'var(--background, #fff)',
                borderRadius: 12, padding: 24, width: 400, maxWidth: '92vw',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
                    Tilføj vare til køleskabet
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)' }}>
                        Varenavn *
                        <div style={{ position: 'relative' }}>
                            <input
                                value={form.name}
                                onChange={e => handleNameChange(e.target.value)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), SUGGESTION_HIDE_DELAY_MS)}
                                placeholder="f.eks. Rugbrød 1,1 kg"
                                style={inputStyle}
                                autoComplete="off"
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    background: 'var(--background, #fff)',
                                    border: '1px solid var(--border, #e5e7eb)',
                                    borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                    zIndex: 10, maxHeight: 220, overflow: 'auto',
                                }}>
                                    {suggestions.map((p, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onMouseDown={() => applySuggestion(p)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                width: '100%', padding: '8px 12px', border: 'none',
                                                background: 'none', cursor: 'pointer', textAlign: 'left',
                                                fontSize: 13, color: 'var(--foreground, #111)',
                                                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border, #f3f4f6)' : 'none',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted, #f9fafb)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                        >
                                            <span>{p.name}</span>
                                            <span style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginLeft: 8 }}>
                                                {p.category}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)' }}>
                            Antal / mængde
                            <input
                                value={form.quantity}
                                onChange={e => set('quantity', e.target.value)}
                                placeholder="f.eks. 1 L"
                                style={inputStyle}
                            />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)' }}>
                            Kategori
                            <select
                                value={form.category}
                                onChange={e => set('category', e.target.value)}
                                style={inputStyle}
                            >
                                {CATEGORY_OPTIONS.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)' }}>
                            Købsdato
                            <input
                                type="date"
                                value={form.purchasedAt}
                                onChange={e => set('purchasedAt', e.target.value)}
                                style={inputStyle}
                            />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)' }}>
                            Udløbsdato
                            <input
                                type="date"
                                value={form.expiresAt ?? ''}
                                onChange={e => set('expiresAt', e.target.value || null)}
                                style={inputStyle}
                            />
                        </label>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={form.opened}
                            onChange={e => set('opened', e.target.checked)}
                        />
                        Allerede åbnet
                    </label>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button onClick={onCancel} style={secondaryBtnStyle}>Annuller</button>
                    <button
                        onClick={() => form.name.trim() && onSave(form)}
                        disabled={!form.name.trim()}
                        style={{ ...primaryBtnStyle, opacity: form.name.trim() ? 1 : 0.4 }}
                    >
                        Gem
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4,
    padding: '7px 10px', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 6, fontSize: 13, background: 'var(--background, #fff)',
    color: 'var(--foreground, #111)',
    boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: 'var(--primary, #6366f1)', color: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 6,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'transparent', color: 'var(--foreground, #111)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export function FoodTrackerDashboardPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<FridgeItem[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<ExpiryStatus | 'all'>('all');

    useEffect(() => {
        setItems(loadFridgeItems());
    }, []);

    const persist = useCallback((next: FridgeItem[]) => {
        setItems(next);
        saveFridgeItems(next);
    }, []);

    const handleAdd = useCallback((item: FridgeItem) => {
        persist([...items, item]);
        setShowAdd(false);
    }, [items, persist]);

    const handleDelete = useCallback((id: string) => {
        persist(items.filter(i => i.id !== id));
    }, [items, persist]);

    const handleToggleOpen = useCallback((id: string) => {
        persist(items.map(i =>
            i.id === id
                ? { ...i, opened: !i.opened, openedAt: !i.opened ? new Date().toISOString() : null }
                : i,
        ));
    }, [items, persist]);

    const filtered = items
        .filter(i => {
            if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (filterStatus !== 'all' && getExpiryStatus(i) !== filterStatus) return false;
            return true;
        })
        .sort((a, b) => {
            // Sort: expired first, then expiring soon, then ok, then unknown
            const order: Record<ExpiryStatus, number> = { expired: 0, 'expiring-soon': 1, ok: 2, unknown: 3 };
            return order[getExpiryStatus(a)] - order[getExpiryStatus(b)];
        });

    const expiredCount = items.filter(i => getExpiryStatus(i) === 'expired').length;
    const expiringSoonCount = items.filter(i => getExpiryStatus(i) === 'expiring-soon').length;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Refrigerator size={20} color="#fff" />
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Digital Køleskab</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        {items.length} vare{items.length !== 1 ? 'r' : ''}
                    </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => navigate('/modules/food-tracker/scan')}
                        style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <ScanLine size={14} /> Scan kvittering
                    </button>
                    <button
                        onClick={() => navigate('/modules/food-tracker/scan-expiry')}
                        style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Camera size={14} /> Scan udløbsdato
                    </button>
                    <button
                        onClick={() => navigate('/modules/food-tracker/recipes')}
                        style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <ChefHat size={14} /> Opskrifter
                    </button>
                    <button
                        onClick={() => setShowAdd(true)}
                        style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Plus size={14} /> Tilføj vare
                    </button>
                </div>
            </div>

            {/* Alert banners */}
            {(expiredCount > 0 || expiringSoonCount > 0) && (
                <div style={{ padding: '10px 24px', display: 'flex', gap: 10, flexShrink: 0 }}>
                    {expiredCount > 0 && (
                        <div style={{
                            flex: 1, padding: '10px 14px', borderRadius: 8,
                            background: '#fee2e2', border: '1px solid #fca5a5',
                            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#dc2626',
                        }}>
                            <AlertTriangle size={16} />
                            <strong>{expiredCount} vare{expiredCount !== 1 ? 'r' : ''}</strong> er udløbet — overvej at smide dem ud.
                        </div>
                    )}
                    {expiringSoonCount > 0 && (
                        <div style={{
                            flex: 1, padding: '10px 14px', borderRadius: 8,
                            background: '#fef3c7', border: '1px solid #fcd34d',
                            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#d97706',
                        }}>
                            <Clock size={16} />
                            <strong>{expiringSoonCount} vare{expiringSoonCount !== 1 ? 'r' : ''}</strong> udløber inden for 3 dage — brug dem snart!
                        </div>
                    )}
                </div>
            )}

            {/* Filters & search */}
            <div style={{
                padding: '10px 24px', borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap',
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground, #6b7280)' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Søg varer…"
                        style={{ ...inputStyle, paddingLeft: 32, marginTop: 0 }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground, #6b7280)', padding: 0 }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                {(['all', 'expired', 'expiring-soon', 'ok', 'unknown'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        style={{
                            padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border, #e5e7eb)',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            background: filterStatus === status ? 'var(--primary, #6366f1)' : 'transparent',
                            color: filterStatus === status ? '#fff' : 'var(--foreground, #111)',
                        }}
                    >
                        {{
                            all: 'Alle',
                            expired: '🔴 Udløbet',
                            'expiring-soon': '🟡 Snart',
                            ok: '🟢 OK',
                            unknown: '⚪ Ukendt',
                        }[status]}
                    </button>
                ))}
            </div>

            {/* Item list */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-foreground, #6b7280)' }}>
                        {items.length === 0 ? (
                            <>
                                <Refrigerator size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>Køleskabet er tomt</p>
                                <p style={{ fontSize: 13, margin: 0 }}>Tilføj varer manuelt eller scan en kvittering.</p>
                            </>
                        ) : (
                            <p style={{ fontSize: 14 }}>Ingen varer matcher søgningen.</p>
                        )}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {filtered.map(item => {
                        const status = getExpiryStatus(item);
                        const borderColor = status === 'expired' ? '#fca5a5' : status === 'expiring-soon' ? '#fcd34d' : 'var(--border, #e5e7eb)';

                        return (
                            <div
                                key={item.id}
                                style={{
                                    padding: 14, borderRadius: 10,
                                    border: `1px solid ${borderColor}`,
                                    background: 'var(--background, #fff)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                    display: 'flex', flexDirection: 'column', gap: 8,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)' }}>
                                            {item.quantity} · {item.category}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground, #6b7280)', padding: 4 }}
                                        title="Fjern vare"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {statusBadge(status, item.expiresAt)}
                                    {item.opened && (
                                        <span style={{
                                            fontSize: 11, padding: '2px 8px', borderRadius: 12,
                                            background: '#ede9fe', color: '#7c3aed', fontWeight: 500,
                                        }}>
                                            Åbnet
                                        </span>
                                    )}
                                </div>

                                <div style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', display: 'flex', gap: 12 }}>
                                    <span>Købt: {new Date(item.purchasedAt).toLocaleDateString('da-DK')}</span>
                                    {item.expiresAt && (
                                        <span>Udløber: {new Date(item.expiresAt).toLocaleDateString('da-DK')}</span>
                                    )}
                                    {item.price && <span>{item.price} kr</span>}
                                </div>

                                <button
                                    onClick={() => handleToggleOpen(item.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: 12, color: 'var(--muted-foreground, #6b7280)',
                                        padding: '2px 0',
                                    }}
                                >
                                    {item.opened ? <CheckSquare size={13} /> : <Square size={13} />}
                                    {item.opened ? 'Markér som uåbnet' : 'Markér som åbnet'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {showAdd && (
                <AddItemModal onSave={handleAdd} onCancel={() => setShowAdd(false)} />
            )}
        </div>
    );
}

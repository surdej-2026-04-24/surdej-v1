import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
    MapPin, Plus, Loader2, AlertTriangle, CheckCircle2,
    Camera, X, Coins, Users,
} from 'lucide-react';
import {
    loadPosters, savePosters, loadTeams, formatCoords,
    TEAM_COLORS, type PosterEntry, type PosterTeam, type PosterStatus,
} from './posterStore';

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4,
    padding: '8px 10px', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 6, fontSize: 13, background: 'var(--background, #fff)',
    color: 'var(--foreground, #111)', boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: 'var(--primary, #6366f1)', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
};

const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600,
    color: 'var(--muted-foreground, #6b7280)',
    display: 'block', marginBottom: 4,
};

// ─── Component ────────────────────────────────────────────────────────────────

type GpsState = 'idle' | 'locating' | 'ready' | 'error';

interface GpsResult {
    lat: number;
    lng: number;
    accuracy: number | null;
}

export function PosterAddPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [teams] = useState<PosterTeam[]>(() => loadTeams());

    // Form state
    const [note, setNote]               = useState('');
    const [teamId, setTeamId]           = useState<string>('');
    const [status, setStatus]           = useState<PosterStatus>('active');
    const [pantAmount, setPantAmount]   = useState('');
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

    // GPS state
    const [gpsState, setGpsState] = useState<GpsState>('idle');
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [gpsResult, setGpsResult] = useState<GpsResult | null>(null);

    // Submission state
    const [submitted, setSubmitted] = useState(false);

    // ── GPS ───────────────────────────────────────────────────────────────────
    const handleGetLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation understøttes ikke af din browser.');
            setGpsState('error');
            return;
        }
        setGpsState('locating');
        setGpsError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsResult({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy ?? null,
                });
                setGpsState('ready');
            },
            (err) => {
                setGpsError(err.message || 'Kunne ikke bestemme placering.');
                setGpsState('error');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    }, []);

    // ── Photo ─────────────────────────────────────────────────────────────────
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Only allow image types
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result;
            if (typeof result === 'string') {
                setImageDataUrl(result);
            }
        };
        reader.readAsDataURL(file);
    }, []);

    const handleRemoveImage = useCallback(() => {
        setImageDataUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(() => {
        if (!gpsResult) return;

        const entry: PosterEntry = {
            id: crypto.randomUUID(),
            lat: gpsResult.lat,
            lng: gpsResult.lng,
            accuracy: gpsResult.accuracy,
            timestamp: new Date().toISOString(),
            note: note.trim(),
            status,
            teamId: teamId || null,
            imageDataUrl,
            pantAmount: status === 'pant' && pantAmount ? Number(pantAmount) : null,
            removedAt: status === 'removed' ? new Date().toISOString() : null,
        };

        const existing = loadPosters();
        savePosters([entry, ...existing]);
        setSubmitted(true);
        setTimeout(() => navigate('/modules/poster-tracker'), 1500);
    }, [gpsResult, note, status, teamId, imageDataUrl, pantAmount, navigate]);

    // ─── Render ──────────────────────────────────────────────────────────────

    if (submitted) {
        return (
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', background: '#dcfce7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                }}>
                    <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Plakat registreret!</h2>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>
                    Sender dig tilbage til oversigten…
                </p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button
                    onClick={() => navigate('/modules/poster-tracker')}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--muted-foreground, #6b7280)', fontSize: 13,
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}
                >
                    ← Tilbage
                </button>
                <div style={{
                    padding: 8, borderRadius: 8,
                    background: 'linear-gradient(135deg, #f97316, #ef4444)',
                    color: '#fff',
                }}>
                    <Plus size={18} />
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Tilføj Plakat</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Registrer en ny valgplakat med GPS og foto
                    </p>
                </div>
            </div>

            {/* ── Step 1: GPS ── */}
            <div style={{
                border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
                padding: 20, marginBottom: 16, background: 'var(--card, #fff)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <MapPin size={16} style={{ color: '#f97316' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Placering (GPS)</span>
                    {gpsState === 'ready' && (
                        <span style={{
                            marginLeft: 'auto', fontSize: 11, padding: '2px 8px',
                            borderRadius: 12, background: '#dcfce7', color: '#16a34a', fontWeight: 600,
                        }}>Klar</span>
                    )}
                </div>

                {gpsState === 'ready' && gpsResult ? (
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                            {formatCoords(gpsResult.lat, gpsResult.lng)}
                        </div>
                        {gpsResult.accuracy != null && (
                            <div style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginBottom: 8 }}>
                                ±{Math.round(gpsResult.accuracy)} m nøjagtighed
                            </div>
                        )}
                        <button
                            onClick={handleGetLocation}
                            style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: '1px solid var(--border, #e5e7eb)',
                                background: 'transparent', color: 'var(--muted-foreground, #6b7280)',
                                fontSize: 12, cursor: 'pointer',
                            }}
                        >
                            Opdater placering
                        </button>
                    </div>
                ) : (
                    <div>
                        {gpsState === 'error' && gpsError && (
                            <div style={{
                                marginBottom: 10, padding: '8px 12px', borderRadius: 6,
                                background: '#fee2e2', color: '#dc2626',
                                fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <AlertTriangle size={14} />
                                {gpsError}
                            </div>
                        )}
                        <button
                            style={{ ...primaryBtnStyle, opacity: gpsState === 'locating' ? 0.7 : 1 }}
                            onClick={handleGetLocation}
                            disabled={gpsState === 'locating'}
                        >
                            {gpsState === 'locating' ? (
                                <><Loader2 size={16} className="animate-spin" />Henter placering…</>
                            ) : (
                                <><MapPin size={16} />Hent min placering</>
                            )}
                        </button>
                        {gpsState === 'locating' && (
                            <p style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginTop: 6, marginBottom: 0 }}>
                                Tillad placeringsadgang hvis du bliver spurgt.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Step 2: Details ── */}
            <div style={{
                border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
                padding: 20, marginBottom: 16, background: 'var(--card, #fff)',
            }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Detaljer</div>

                {/* Note */}
                <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle} htmlFor="pt-note">Note (valgfri)</label>
                    <input
                        id="pt-note"
                        type="text"
                        placeholder="f.eks. Busstoppested, lygtepæl hjørne…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        style={inputStyle}
                        maxLength={200}
                    />
                </div>

                {/* Team */}
                {teams.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle} htmlFor="pt-team">
                            <Users size={12} style={{ display: 'inline', marginRight: 4 }} />
                            Team / Parti (valgfri)
                        </label>
                        <select
                            id="pt-team"
                            value={teamId}
                            onChange={(e) => setTeamId(e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">— Intet team —</option>
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Status */}
                <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Status</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {([
                            { value: 'active', label: 'Aktiv', color: '#16a34a', bg: '#dcfce7' },
                            { value: 'removed', label: 'Nedtaget', color: '#64748b', bg: '#f1f5f9' },
                            { value: 'pant', label: 'Pant', color: '#d97706', bg: '#fef3c7' },
                        ] as { value: PosterStatus; label: string; color: string; bg: string }[]).map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setStatus(opt.value)}
                                style={{
                                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    cursor: 'pointer', border: `2px solid ${status === opt.value ? opt.color : 'transparent'}`,
                                    background: opt.bg, color: opt.color,
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Pant amount */}
                {status === 'pant' && (
                    <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle} htmlFor="pt-pant">
                            <Coins size={12} style={{ display: 'inline', marginRight: 4 }} />
                            Pant beløb (kr)
                        </label>
                        <input
                            id="pt-pant"
                            type="number"
                            placeholder="f.eks. 50"
                            value={pantAmount}
                            onChange={(e) => setPantAmount(e.target.value)}
                            style={inputStyle}
                            min="0"
                            max="9999"
                        />
                        <p style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', margin: '4px 0 0' }}>
                            Borgere kan tjene dette beløb ved at nedtage plakaten og undgå bøden på 400 kr.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Step 3: Photo ── */}
            <div style={{
                border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
                padding: 20, marginBottom: 24, background: 'var(--card, #fff)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Camera size={16} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Foto (valgfri)</span>
                </div>

                {imageDataUrl ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                            src={imageDataUrl}
                            alt="Valgt foto"
                            style={{
                                maxWidth: '100%', maxHeight: 220, borderRadius: 8,
                                objectFit: 'cover', border: '1px solid var(--border, #e5e7eb)',
                                display: 'block',
                            }}
                        />
                        <button
                            onClick={handleRemoveImage}
                            style={{
                                position: 'absolute', top: 6, right: 6,
                                background: 'rgba(0,0,0,0.6)', border: 'none',
                                borderRadius: '50%', width: 26, height: 26,
                                cursor: 'pointer', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="Fjern foto"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            id="pt-photo"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                padding: '10px 20px', borderRadius: 8,
                                border: '1px dashed var(--border, #e5e7eb)',
                                background: 'transparent', color: 'var(--muted-foreground, #6b7280)',
                                fontSize: 13, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}
                        >
                            <Camera size={16} />
                            Tag billede / Vælg fil
                        </button>
                        <p style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', margin: '6px 0 0' }}>
                            Billede vises som dokumentation af plakaten.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Submit ── */}
            <button
                style={{
                    ...primaryBtnStyle,
                    width: '100%', justifyContent: 'center',
                    opacity: !gpsResult ? 0.5 : 1,
                    fontSize: 15,
                }}
                onClick={handleSubmit}
                disabled={!gpsResult}
            >
                <MapPin size={16} />
                Registrér plakat
            </button>
            {!gpsResult && (
                <p style={{ fontSize: 12, color: 'var(--muted-foreground, #9ca3af)', textAlign: 'center', marginTop: 8 }}>
                    Hent GPS-placering for at fortsætte.
                </p>
            )}
        </div>
    );
}

// Re-export TEAM_COLORS to avoid lint warning
export { TEAM_COLORS };

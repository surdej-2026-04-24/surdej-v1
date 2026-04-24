import { useState, useCallback } from 'react';
import { MapPin, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, StickyNote } from 'lucide-react';
import {
    loadPosters, savePosters, formatCoords,
    type PosterEntry,
} from './posterStore';

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4,
    padding: '6px 10px', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 6, fontSize: 12, background: 'var(--background, #fff)',
    color: 'var(--foreground, #111)', boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: 'var(--primary, #6366f1)', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
};

const dangerBtnStyle: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5',
    background: 'transparent', color: '#dc2626',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
};

// ─── Component ────────────────────────────────────────────────────────────────

type GpsState = 'idle' | 'locating' | 'error';

export function PosterTrackerDashboardPage() {
    const [entries, setEntries] = useState<PosterEntry[]>(() => loadPosters());
    const [gpsState, setGpsState] = useState<GpsState>('idle');
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [pendingNote, setPendingNote] = useState('');
    const [justAdded, setJustAdded] = useState<string | null>(null);

    // ── Register poster at current GPS location ─────────────────────────────
    const handleRegister = useCallback(() => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by this browser.');
            setGpsState('error');
            return;
        }

        setGpsState('locating');
        setGpsError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const entry: PosterEntry = {
                    id: crypto.randomUUID(),
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy ?? null,
                    timestamp: new Date().toISOString(),
                    note: pendingNote.trim(),
                };
                const updated = [entry, ...entries];
                savePosters(updated);
                setEntries(updated);
                setPendingNote('');
                setGpsState('idle');
                setJustAdded(entry.id);
                setTimeout(() => setJustAdded(null), 3000);
            },
            (err) => {
                setGpsError(err.message || 'Could not obtain location.');
                setGpsState('error');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    }, [entries, pendingNote]);

    // ── Delete entry ────────────────────────────────────────────────────────
    const handleDelete = useCallback((id: string) => {
        const updated = entries.filter((e) => e.id !== id);
        savePosters(updated);
        setEntries(updated);
    }, [entries]);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                    padding: 10, borderRadius: 10,
                    background: 'linear-gradient(135deg, #f97316, #ef4444)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                }}>
                    <MapPin size={22} />
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Poster Tracker</h1>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Register poster locations using your device GPS
                    </p>
                </div>
            </div>

            {/* Stats badge */}
            <div style={{ marginBottom: 24 }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, padding: '3px 10px', borderRadius: 20,
                    border: '1px solid var(--border, #e5e7eb)',
                    color: 'var(--muted-foreground, #6b7280)',
                }}>
                    <MapPin size={12} />
                    {entries.length} poster{entries.length !== 1 ? 's' : ''} registered
                </span>
            </div>

            {/* Registration card */}
            <div style={{
                border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
                padding: 20, marginBottom: 28, background: 'var(--card, #fff)',
            }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>
                    Register new poster
                </h2>

                {/* Optional note */}
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground, #6b7280)' }}>
                    Note (optional)
                    <input
                        type="text"
                        placeholder="e.g. Bus stop, lamppost corner…"
                        value={pendingNote}
                        onChange={(e) => setPendingNote(e.target.value)}
                        style={inputStyle}
                        disabled={gpsState === 'locating'}
                        maxLength={120}
                    />
                </label>

                {/* GPS error */}
                {gpsState === 'error' && gpsError && (
                    <div style={{
                        marginTop: 10, padding: '8px 12px', borderRadius: 6,
                        background: '#fee2e2', color: '#dc2626',
                        fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <AlertTriangle size={14} />
                        {gpsError}
                    </div>
                )}

                {/* Register button */}
                <div style={{ marginTop: 14 }}>
                    <button
                        style={{
                            ...primaryBtnStyle,
                            opacity: gpsState === 'locating' ? 0.7 : 1,
                        }}
                        onClick={handleRegister}
                        disabled={gpsState === 'locating'}
                    >
                        {gpsState === 'locating' ? (
                            <>
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                Getting location…
                            </>
                        ) : (
                            <>
                                <Plus size={16} />
                                Register Poster Here
                            </>
                        )}
                    </button>
                </div>

                {gpsState === 'locating' && (
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginTop: 6, marginBottom: 0 }}>
                        Waiting for GPS signal — please allow location access if prompted.
                    </p>
                )}
            </div>

            {/* Poster list */}
            {entries.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '48px 16px',
                    color: 'var(--muted-foreground, #9ca3af)',
                }}>
                    <MapPin size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, margin: 0 }}>No posters registered yet.</p>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                        Click <strong>Register Poster Here</strong> to record the first location.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--muted-foreground, #6b7280)' }}>
                        Registered locations
                    </h2>
                    {entries.map((entry, idx) => (
                        <PosterCard
                            key={entry.id}
                            entry={entry}
                            index={entries.length - idx}
                            isNew={justAdded === entry.id}
                            onDelete={() => handleDelete(entry.id)}
                        />
                    ))}
                </div>
            )}

            {/* Spin keyframe injected inline */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Poster Card ──────────────────────────────────────────────────────────────

interface PosterCardProps {
    entry: PosterEntry;
    index: number;
    isNew: boolean;
    onDelete: () => void;
}

function PosterCard({ entry, index, isNew, onDelete }: PosterCardProps) {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { dateStyle: 'medium' });
    const timeStr = date.toLocaleTimeString(undefined, { timeStyle: 'short' });

    return (
        <div style={{
            border: `1px solid ${isNew ? '#86efac' : 'var(--border, #e5e7eb)'}`,
            borderRadius: 10,
            padding: '14px 16px',
            background: isNew ? '#f0fdf4' : 'var(--card, #fff)',
            transition: 'border-color 0.5s, background 0.5s',
            display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
            {/* Icon / number */}
            <div style={{
                minWidth: 36, height: 36, borderRadius: 8,
                background: isNew
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'linear-gradient(135deg, #f97316, #ef4444)',
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 700,
                flexShrink: 0,
            }}>
                {isNew ? <CheckCircle2 size={18} /> : index}
            </div>

            {/* Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {formatCoords(entry.lat, entry.lng)}
                </div>
                {entry.accuracy != null && (
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginBottom: 4 }}>
                        ±{Math.round(entry.accuracy)} m accuracy
                    </div>
                )}
                {entry.note && (
                    <div style={{
                        fontSize: 12, color: 'var(--foreground, #374151)',
                        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
                    }}>
                        <StickyNote size={12} style={{ opacity: 0.6 }} />
                        {entry.note}
                    </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)' }}>
                    {dateStr} · {timeStr}
                </div>
                {/* OpenStreetMap link */}
                <a
                    href={`https://www.openstreetmap.org/?mlat=${entry.lat}&mlon=${entry.lng}&zoom=18`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--primary, #6366f1)', marginTop: 4, display: 'inline-block' }}
                >
                    View on map ↗
                </a>
            </div>

            {/* Delete */}
            <button
                onClick={onDelete}
                style={dangerBtnStyle}
                title="Delete this entry"
            >
                <Trash2 size={13} />
                Remove
            </button>
        </div>
    );
}

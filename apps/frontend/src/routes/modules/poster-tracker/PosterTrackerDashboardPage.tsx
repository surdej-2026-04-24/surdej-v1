import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
    MapPin, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2,
    StickyNote, Users, Coins, Eye, EyeOff, CircleDot,
} from 'lucide-react';
import {
    loadPosters, savePosters, loadTeams, formatCoords, buildMapLink,
    type PosterEntry, type PosterTeam,
} from './posterStore';

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
    border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
    padding: 20, background: 'var(--card, #fff)',
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

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active:  { bg: '#dcfce7', text: '#16a34a', label: 'Aktiv' },
    removed: { bg: '#f1f5f9', text: '#64748b', label: 'Nedtaget' },
    pant:    { bg: '#fef3c7', text: '#d97706', label: 'Pant' },
};

// ─── Component ────────────────────────────────────────────────────────────────

type GpsState = 'idle' | 'locating' | 'error';
type FilterStatus = 'all' | 'active' | 'removed' | 'pant';

export function PosterTrackerDashboardPage() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<PosterEntry[]>(() => loadPosters());
    const [teams] = useState<PosterTeam[]>(() => loadTeams());
    const [gpsState, setGpsState] = useState<GpsState>('idle');
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [pendingNote, setPendingNote] = useState('');
    const [justAdded, setJustAdded] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [showImages, setShowImages] = useState(false);

    // ── Statistics ────────────────────────────────────────────────────────────
    const total   = entries.length;
    const active  = entries.filter((e) => e.status === 'active').length;
    const removed = entries.filter((e) => e.status === 'removed').length;
    const pant    = entries.filter((e) => e.status === 'pant').length;

    // ── Filtered list ─────────────────────────────────────────────────────────
    const filtered = filterStatus === 'all'
        ? entries
        : entries.filter((e) => e.status === filterStatus);

    // ── Quick GPS register ────────────────────────────────────────────────────
    const handleRegister = useCallback(() => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation understøttes ikke af din browser.');
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
                    status: 'active',
                    teamId: null,
                    imageDataUrl: null,
                    pantAmount: null,
                    removedAt: null,
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
                setGpsError(err.message || 'Kunne ikke bestemme placering.');
                setGpsState('error');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    }, [entries, pendingNote]);

    // ── Delete entry ──────────────────────────────────────────────────────────
    const handleDelete = useCallback((id: string) => {
        const updated = entries.filter((e) => e.id !== id);
        savePosters(updated);
        setEntries(updated);
    }, [entries]);

    // ── Mark removed ─────────────────────────────────────────────────────────
    const handleMarkRemoved = useCallback((id: string) => {
        const updated = entries.map((e) =>
            e.id === id
                ? { ...e, status: 'removed' as const, removedAt: new Date().toISOString() }
                : e,
        );
        savePosters(updated);
        setEntries(updated);
    }, [entries]);

    // ─── Render ──────────────────────────────────────────────────────────────

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                    padding: 10, borderRadius: 10,
                    background: 'linear-gradient(135deg, #f97316, #ef4444)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                }}>
                    <MapPin size={22} />
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Valgplakater</h1>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Registrer og administrer valgplakater med GPS
                    </p>
                </div>
            </div>

            {/* ── Quick action buttons ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, marginTop: 12 }}>
                <button style={primaryBtnStyle} onClick={() => navigate('/modules/poster-tracker/add')}>
                    <Plus size={16} />
                    Tilføj plakat
                </button>
                <button
                    style={{
                        ...primaryBtnStyle,
                        background: 'transparent',
                        color: 'var(--foreground, #111)',
                        border: '1px solid var(--border, #e5e7eb)',
                    }}
                    onClick={() => navigate('/modules/poster-tracker/teams')}
                >
                    <Users size={16} />
                    Teams
                </button>
                <button
                    style={{
                        ...primaryBtnStyle,
                        background: 'transparent',
                        color: '#d97706',
                        border: '1px solid #fcd34d',
                    }}
                    onClick={() => navigate('/modules/poster-tracker/pant')}
                >
                    <Coins size={16} />
                    Pant ({pant})
                </button>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
                {([
                    { label: 'Total', value: total, color: '#6366f1' },
                    { label: 'Aktive', value: active, color: '#16a34a' },
                    { label: 'Nedtaget', value: removed, color: '#64748b' },
                    { label: 'Pant', value: pant, color: '#d97706' },
                ] as { label: string; value: number; color: string }[]).map((stat) => (
                    <div key={stat.label} style={{
                        ...cardStyle, padding: '12px 16px', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginTop: 2 }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Quick register card ── */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>
                    Hurtig registrering
                </h2>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: '0 0 10px' }}>
                    Brug GPS til at registrere din aktuelle position. Brug <em>Tilføj plakat</em> for foto og team-tilknytning.
                </p>

                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground, #6b7280)' }}>
                    Note (valgfri)
                    <input
                        type="text"
                        placeholder="f.eks. Busstoppested, lygtepæl hjørne…"
                        value={pendingNote}
                        onChange={(e) => setPendingNote(e.target.value)}
                        style={{
                            display: 'block', width: '100%', marginTop: 4,
                            padding: '6px 10px', border: '1px solid var(--border, #e5e7eb)',
                            borderRadius: 6, fontSize: 12, background: 'var(--background, #fff)',
                            color: 'var(--foreground, #111)', boxSizing: 'border-box',
                        }}
                        disabled={gpsState === 'locating'}
                        maxLength={120}
                    />
                </label>

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

                <div style={{ marginTop: 14 }}>
                    <button
                        style={{ ...primaryBtnStyle, opacity: gpsState === 'locating' ? 0.7 : 1 }}
                        onClick={handleRegister}
                        disabled={gpsState === 'locating'}
                    >
                        {gpsState === 'locating' ? (
                            <><Loader2 size={16} className="animate-spin" />Henter placering…</>
                        ) : (
                            <><MapPin size={16} />Registrér her</>
                        )}
                    </button>
                </div>

                {gpsState === 'locating' && (
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginTop: 6, marginBottom: 0 }}>
                        Venter på GPS-signal — tillad placeringsadgang hvis du bliver spurgt.
                    </p>
                )}
            </div>

            {/* ── Filter bar ── */}
            {entries.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    {(['all', 'active', 'removed', 'pant'] as FilterStatus[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            style={{
                                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                                border: '1px solid var(--border, #e5e7eb)', cursor: 'pointer',
                                background: filterStatus === s ? 'var(--primary, #6366f1)' : 'transparent',
                                color: filterStatus === s ? '#fff' : 'var(--muted-foreground, #6b7280)',
                            }}
                        >
                            {s === 'all' ? `Alle (${total})` :
                             s === 'active' ? `Aktive (${active})` :
                             s === 'removed' ? `Nedtaget (${removed})` :
                             `Pant (${pant})`}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowImages((v) => !v)}
                        style={{
                            marginLeft: 'auto', padding: '4px 10px', borderRadius: 20,
                            fontSize: 12, border: '1px solid var(--border, #e5e7eb)',
                            background: 'transparent', cursor: 'pointer',
                            color: 'var(--muted-foreground, #6b7280)',
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}
                    >
                        {showImages ? <EyeOff size={12} /> : <Eye size={12} />}
                        {showImages ? 'Skjul fotos' : 'Vis fotos'}
                    </button>
                </div>
            )}

            {/* ── Poster list ── */}
            {entries.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '48px 16px',
                    color: 'var(--muted-foreground, #9ca3af)',
                }}>
                    <MapPin size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, margin: 0 }}>Ingen plakater registreret endnu.</p>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                        Klik <strong>Tilføj plakat</strong> for at registrere den første placering.
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '32px 16px',
                    color: 'var(--muted-foreground, #9ca3af)',
                }}>
                    <CircleDot size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <p style={{ fontSize: 13, margin: 0 }}>Ingen plakater matcher filteret.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--muted-foreground, #6b7280)' }}>
                        Registrerede plakater ({filtered.length})
                    </h2>
                    {filtered.map((entry, idx) => (
                        <PosterCard
                            key={entry.id}
                            entry={entry}
                            index={filtered.length - idx}
                            isNew={justAdded === entry.id}
                            team={entry.teamId ? (teamMap.get(entry.teamId) ?? null) : null}
                            showImage={showImages}
                            onDelete={() => handleDelete(entry.id)}
                            onMarkRemoved={() => handleMarkRemoved(entry.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Poster Card ──────────────────────────────────────────────────────────────

interface PosterCardProps {
    entry: PosterEntry;
    index: number;
    isNew: boolean;
    team: PosterTeam | null;
    showImage: boolean;
    onDelete: () => void;
    onMarkRemoved: () => void;
}

function PosterCard({ entry, index, isNew, team, showImage, onDelete, onMarkRemoved }: PosterCardProps) {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString('da-DK', { dateStyle: 'medium' });
    const timeStr = date.toLocaleTimeString('da-DK', { timeStyle: 'short' });
    const sc = statusColors[entry.status] ?? statusColors.active;

    return (
        <div style={{
            border: `1px solid ${isNew ? '#86efac' : 'var(--border, #e5e7eb)'}`,
            borderRadius: 10,
            padding: '14px 16px',
            background: isNew ? '#f0fdf4' : 'var(--card, #fff)',
            transition: 'border-color 0.5s, background 0.5s',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Icon / number */}
                <div style={{
                    minWidth: 36, height: 36, borderRadius: 8,
                    background: isNew
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                        : 'linear-gradient(135deg, #f97316, #ef4444)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                    {isNew ? <CheckCircle2 size={18} /> : index}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {formatCoords(entry.lat, entry.lng)}
                        </span>
                        <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                            background: sc.bg, color: sc.text,
                        }}>
                            {sc.label}
                        </span>
                        {entry.pantAmount != null && (
                            <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                                background: '#fef9c3', color: '#92400e',
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                            }}>
                                <Coins size={10} />
                                {entry.pantAmount} kr
                            </span>
                        )}
                    </div>
                    {entry.accuracy != null && (
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginBottom: 2 }}>
                            ±{Math.round(entry.accuracy)} m nøjagtighed
                        </div>
                    )}
                    {team && (
                        <div style={{ fontSize: 11, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                background: team.color, flexShrink: 0,
                            }} />
                            <span style={{ color: 'var(--muted-foreground, #6b7280)' }}>{team.name}</span>
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
                    <a
                        href={buildMapLink(entry.lat, entry.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--primary, #6366f1)', marginTop: 4, display: 'inline-block' }}
                    >
                        Vis på kort ↗
                    </a>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    {entry.status === 'active' && (
                        <button onClick={onMarkRemoved} style={{
                            padding: '4px 10px', borderRadius: 6,
                            border: '1px solid #bbf7d0', background: 'transparent', color: '#16a34a',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                            <CheckCircle2 size={13} />
                            Nedtaget
                        </button>
                    )}
                    <button onClick={onDelete} style={dangerBtnStyle} title="Slet registrering">
                        <Trash2 size={13} />
                        Slet
                    </button>
                </div>
            </div>

            {/* Image */}
            {showImage && entry.imageDataUrl && (
                <div style={{ marginTop: 10 }}>
                    <img
                        src={entry.imageDataUrl}
                        alt="Plakat billede"
                        style={{
                            maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                            objectFit: 'cover', border: '1px solid var(--border, #e5e7eb)',
                        }}
                    />
                </div>
            )}
        </div>
    );
}

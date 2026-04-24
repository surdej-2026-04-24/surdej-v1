import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Coins, MapPin, CheckCircle2, AlertTriangle, StickyNote, Plus } from 'lucide-react';
import {
    loadPosters, savePosters, loadTeams, formatCoords, buildMapLink,
    type PosterEntry, type PosterTeam,
} from './posterStore';

// ─── Styles ──────────────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: 'var(--primary, #6366f1)', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PosterPantPage() {
    const navigate = useNavigate();
    const [posters, setPosters] = useState<PosterEntry[]>(() => loadPosters());
    const [teams] = useState<PosterTeam[]>(() => loadTeams());
    const [claimedId, setClaimedId] = useState<string | null>(null);

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    const pantPosters = posters.filter((p) => p.status === 'pant');

    // ── Claim poster (mark as removed) ────────────────────────────────────────
    const handleClaim = useCallback((id: string) => {
        const updated = posters.map((p) =>
            p.id === id
                ? { ...p, status: 'removed' as const, removedAt: new Date().toISOString() }
                : p,
        );
        savePosters(updated);
        setPosters(updated);
        setClaimedId(id);
        setTimeout(() => setClaimedId(null), 4000);
    }, [posters]);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                    padding: 10, borderRadius: 10,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                }}>
                    <Coins size={22} />
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Pant</h1>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Plakater til rådighed for borgere — fjern plakaten og tjen penge
                    </p>
                </div>
            </div>

            {/* ── Info box ── */}
            <div style={{
                border: '1px solid #fde68a', borderRadius: 10,
                padding: '12px 16px', marginBottom: 20, background: '#fffbeb',
            }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                    Hvad er pant?
                </div>
                <p style={{ fontSize: 12, color: '#78350f', margin: 0 }}>
                    Politiske partier kan markere en plakat som <strong>pant</strong>. Borgere
                    og frivillige kan så nedtage plakaten og partiet undgår bøden på 400 kr.
                    Borgeren får det angivne beløb i belønning. Kontakt partiet for at modtage betaling
                    efter nedtagning.
                </p>
            </div>

            {/* ── Pant list ── */}
            {pantPosters.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '48px 16px',
                    color: 'var(--muted-foreground, #9ca3af)',
                }}>
                    <Coins size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, margin: 0 }}>Ingen plakater til pant i øjeblikket.</p>
                    <p style={{ fontSize: 12, margin: '4px 0 8px' }}>
                        Partier kan markere plakater som pant via oversigten.
                    </p>
                    <button style={primaryBtnStyle} onClick={() => navigate('/modules/poster-tracker/add')}>
                        <Plus size={16} />
                        Tilføj plakat med pant
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--muted-foreground, #6b7280)' }}>
                        Tilgængelige pant-plakater ({pantPosters.length})
                    </h2>
                    {pantPosters.map((entry) => (
                        <PantCard
                            key={entry.id}
                            entry={entry}
                            team={entry.teamId ? (teamMap.get(entry.teamId) ?? null) : null}
                            isClaimed={claimedId === entry.id}
                            onClaim={() => handleClaim(entry.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Pant Card ────────────────────────────────────────────────────────────────

interface PantCardProps {
    entry: PosterEntry;
    team: PosterTeam | null;
    isClaimed: boolean;
    onClaim: () => void;
}

function PantCard({ entry, team, isClaimed, onClaim }: PantCardProps) {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString('da-DK', { dateStyle: 'medium' });

    if (isClaimed) {
        return (
            <div style={{
                border: '1px solid #86efac', borderRadius: 10,
                padding: '20px 16px', background: '#f0fdf4', textAlign: 'center',
            }}>
                <CheckCircle2 size={28} style={{ color: '#16a34a', marginBottom: 6 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>
                    Plakat markeret som nedtaget!
                </div>
                <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                    Husk at kontakte partiet for at modtage din betaling.
                </div>
            </div>
        );
    }

    return (
        <div style={{
            border: '1px solid #fde68a', borderRadius: 10,
            padding: '14px 16px', background: '#fffbeb',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Coin icon */}
                <div style={{
                    minWidth: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                }}>
                    <Coins size={20} />
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Pant amount badge */}
                    {entry.pantAmount != null && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 16, fontWeight: 700, color: '#92400e',
                            background: '#fef9c3', padding: '3px 10px', borderRadius: 8,
                            border: '1px solid #fde68a', marginBottom: 6,
                        }}>
                            <Coins size={14} />
                            {entry.pantAmount} kr
                        </div>
                    )}

                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                        <MapPin size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.7 }} />
                        {formatCoords(entry.lat, entry.lng)}
                    </div>

                    {entry.accuracy != null && (
                        <div style={{ fontSize: 11, color: '#92400e', marginBottom: 4 }}>
                            ±{Math.round(entry.accuracy)} m nøjagtighed
                        </div>
                    )}

                    {team && (
                        <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                background: team.color, flexShrink: 0,
                            }} />
                            <span style={{ color: '#78350f', fontWeight: 600 }}>{team.name}</span>
                        </div>
                    )}

                    {entry.note && (
                        <div style={{
                            fontSize: 12, color: '#78350f',
                            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
                        }}>
                            <StickyNote size={12} style={{ opacity: 0.6 }} />
                            {entry.note}
                        </div>
                    )}

                    <div style={{ fontSize: 11, color: '#92400e', marginBottom: 8 }}>
                        Registreret: {dateStr}
                    </div>

                    <a
                        href={buildMapLink(entry.lat, entry.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#d97706', display: 'inline-block', marginRight: 12 }}
                    >
                        Vis på kort ↗
                    </a>
                </div>
            </div>

            {/* Image */}
            {entry.imageDataUrl && (
                <div style={{ marginTop: 10 }}>
                    <img
                        src={entry.imageDataUrl}
                        alt="Plakat billede"
                        style={{
                            maxWidth: '100%', maxHeight: 180, borderRadius: 8,
                            objectFit: 'cover', border: '1px solid #fde68a',
                            display: 'block',
                        }}
                    />
                </div>
            )}

            {/* Claim button */}
            <div style={{ marginTop: 12 }}>
                <button
                    onClick={onClaim}
                    style={{
                        padding: '9px 20px', borderRadius: 8, border: 'none',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}
                >
                    <CheckCircle2 size={15} />
                    Jeg har nedtaget denne plakat
                </button>
                <p style={{ fontSize: 11, color: '#92400e', margin: '6px 0 0' }}>
                    <AlertTriangle size={11} style={{ display: 'inline', marginRight: 2 }} />
                    Klik kun når plakaten faktisk er nedtaget fysisk.
                </p>
            </div>
        </div>
    );
}

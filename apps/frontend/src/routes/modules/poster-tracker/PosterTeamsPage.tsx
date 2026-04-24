import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Users, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import {
    loadTeams, saveTeams, loadPosters, TEAM_COLORS,
    type PosterTeam,
} from './posterStore';

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4,
    padding: '8px 10px', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 6, fontSize: 13, background: 'var(--background, #fff)',
    color: 'var(--foreground, #111)', boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: 'var(--primary, #6366f1)', color: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PosterTeamsPage() {
    const navigate = useNavigate();
    const [teams, setTeams] = useState<PosterTeam[]>(() => loadTeams());
    const [posters] = useState(() => loadPosters());

    // Create form state
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newColor, setNewColor] = useState(TEAM_COLORS[0]!);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editColor, setEditColor] = useState('');

    // ── Create team ───────────────────────────────────────────────────────────
    const handleCreate = useCallback(() => {
        const name = newName.trim();
        if (!name) return;

        const team: PosterTeam = {
            id: crypto.randomUUID(),
            name,
            color: newColor,
            description: newDescription.trim(),
            createdAt: new Date().toISOString(),
        };
        const updated = [...teams, team];
        saveTeams(updated);
        setTeams(updated);
        setNewName('');
        setNewDescription('');
        setNewColor(TEAM_COLORS[0]!);
        setShowCreate(false);
    }, [teams, newName, newDescription, newColor]);

    // ── Start editing ─────────────────────────────────────────────────────────
    const startEdit = useCallback((team: PosterTeam) => {
        setEditingId(team.id);
        setEditName(team.name);
        setEditDescription(team.description);
        setEditColor(team.color);
    }, []);

    // ── Save edit ─────────────────────────────────────────────────────────────
    const saveEdit = useCallback(() => {
        const name = editName.trim();
        if (!name || !editingId) return;
        const updated = teams.map((t) =>
            t.id === editingId
                ? { ...t, name, description: editDescription.trim(), color: editColor }
                : t,
        );
        saveTeams(updated);
        setTeams(updated);
        setEditingId(null);
    }, [teams, editingId, editName, editDescription, editColor]);

    // ── Delete team ───────────────────────────────────────────────────────────
    const handleDelete = useCallback((id: string) => {
        const updated = teams.filter((t) => t.id !== id);
        saveTeams(updated);
        setTeams(updated);
    }, [teams]);

    // ── Poster count per team ─────────────────────────────────────────────────
    const posterCount = useCallback((teamId: string) => {
        return posters.filter((p) => p.teamId === teamId).length;
    }, [posters]);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
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
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                }}>
                    <Users size={18} />
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Teams & Organisationer</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Opret og administrer partier eller kampagneteams
                    </p>
                </div>
                <button
                    style={{ ...primaryBtnStyle, marginLeft: 'auto' }}
                    onClick={() => setShowCreate(true)}
                >
                    <Plus size={14} />
                    Nyt team
                </button>
            </div>

            {/* ── Create form ── */}
            {showCreate && (
                <div style={{
                    border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
                    padding: 20, marginBottom: 20, background: 'var(--card, #fff)',
                }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Opret nyt team</h3>

                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)', display: 'block', marginBottom: 4 }} htmlFor="team-name">
                            Navn *
                        </label>
                        <input
                            id="team-name"
                            type="text"
                            placeholder="f.eks. Socialdemokraterne"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            style={inputStyle}
                            maxLength={80}
                            autoFocus
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)', display: 'block', marginBottom: 4 }} htmlFor="team-desc">
                            Beskrivelse (valgfri)
                        </label>
                        <input
                            id="team-desc"
                            type="text"
                            placeholder="f.eks. Kampagneteam 2025"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            style={inputStyle}
                            maxLength={200}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #6b7280)', display: 'block', marginBottom: 8 }}>
                            Teamfarve
                        </label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {TEAM_COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setNewColor(c)}
                                    style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: c, border: `3px solid ${newColor === c ? '#000' : 'transparent'}`,
                                        cursor: 'pointer', padding: 0,
                                    }}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button style={primaryBtnStyle} onClick={handleCreate} disabled={!newName.trim()}>
                            <Check size={14} />
                            Opret
                        </button>
                        <button
                            onClick={() => { setShowCreate(false); setNewName(''); setNewDescription(''); }}
                            style={{
                                padding: '8px 16px', borderRadius: 8,
                                border: '1px solid var(--border, #e5e7eb)',
                                background: 'transparent', color: 'var(--muted-foreground, #6b7280)',
                                fontSize: 13, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                            }}
                        >
                            <X size={14} />
                            Annuller
                        </button>
                    </div>
                </div>
            )}

            {/* ── Team list ── */}
            {teams.length === 0 && !showCreate ? (
                <div style={{
                    textAlign: 'center', padding: '48px 16px',
                    color: 'var(--muted-foreground, #9ca3af)',
                }}>
                    <Users size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, margin: 0 }}>Ingen teams oprettet endnu.</p>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                        Klik <strong>Nyt team</strong> for at oprette dit første team.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {teams.map((team) => (
                        <TeamCard
                            key={team.id}
                            team={team}
                            posterCount={posterCount(team.id)}
                            isEditing={editingId === team.id}
                            editName={editName}
                            editDescription={editDescription}
                            editColor={editColor}
                            onEditNameChange={setEditName}
                            onEditDescChange={setEditDescription}
                            onEditColorChange={setEditColor}
                            onStartEdit={() => startEdit(team)}
                            onSaveEdit={saveEdit}
                            onCancelEdit={() => setEditingId(null)}
                            onDelete={() => handleDelete(team.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

interface TeamCardProps {
    team: PosterTeam;
    posterCount: number;
    isEditing: boolean;
    editName: string;
    editDescription: string;
    editColor: string;
    onEditNameChange: (v: string) => void;
    onEditDescChange: (v: string) => void;
    onEditColorChange: (v: string) => void;
    onStartEdit: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onDelete: () => void;
}

function TeamCard({
    team, posterCount, isEditing,
    editName, editDescription, editColor,
    onEditNameChange, onEditDescChange, onEditColorChange,
    onStartEdit, onSaveEdit, onCancelEdit, onDelete,
}: TeamCardProps) {
    return (
        <div style={{
            border: '1px solid var(--border, #e5e7eb)', borderRadius: 10,
            padding: '14px 16px', background: 'var(--card, #fff)',
        }}>
            {isEditing ? (
                <div>
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => onEditNameChange(e.target.value)}
                        style={{ ...inputStyle, marginBottom: 8 }}
                        maxLength={80}
                        autoFocus
                    />
                    <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => onEditDescChange(e.target.value)}
                        style={{ ...inputStyle, marginBottom: 10 }}
                        placeholder="Beskrivelse"
                        maxLength={200}
                    />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {TEAM_COLORS.map((c) => (
                            <button
                                key={c}
                                onClick={() => onEditColorChange(c)}
                                style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    background: c, border: `3px solid ${editColor === c ? '#000' : 'transparent'}`,
                                    cursor: 'pointer', padding: 0,
                                }}
                            />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={onSaveEdit} style={{ ...primaryBtnStyle, fontSize: 12, padding: '6px 12px' }}>
                            <Check size={13} />Gem
                        </button>
                        <button onClick={onCancelEdit} style={{
                            padding: '6px 12px', borderRadius: 6, fontSize: 12,
                            border: '1px solid var(--border, #e5e7eb)',
                            background: 'transparent', cursor: 'pointer',
                            color: 'var(--muted-foreground, #6b7280)',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                            <X size={13} />Annuller
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: team.color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{team.name}</div>
                        {team.description && (
                            <div style={{ fontSize: 12, color: 'var(--muted-foreground, #9ca3af)', marginTop: 2 }}>
                                {team.description}
                            </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', marginTop: 2 }}>
                            {posterCount} plakat{posterCount !== 1 ? 'er' : ''}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={onStartEdit}
                            style={{
                                padding: '5px 10px', borderRadius: 6,
                                border: '1px solid var(--border, #e5e7eb)',
                                background: 'transparent', color: 'var(--muted-foreground, #6b7280)',
                                fontSize: 12, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            <Edit2 size={12} />Rediger
                        </button>
                        <button
                            onClick={onDelete}
                            style={{
                                padding: '5px 10px', borderRadius: 6,
                                border: '1px solid #fca5a5', background: 'transparent',
                                color: '#dc2626', fontSize: 12, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            <Trash2 size={12} />Slet
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

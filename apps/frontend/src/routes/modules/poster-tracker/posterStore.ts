/**
 * Shared types and localStorage persistence for the Poster Tracker feature.
 */

// ─── Team / Organisation ──────────────────────────────────────────────────────

export interface PosterTeam {
    id: string;
    name: string;
    color: string;       // hex color, e.g. "#ef4444"
    description: string;
    createdAt: string;   // ISO date-time
}

const TEAMS_KEY = 'surdej_poster_tracker_teams';

export function loadTeams(): PosterTeam[] {
    try {
        const raw = localStorage.getItem(TEAMS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as PosterTeam[];
        return parsed.filter(
            (t) =>
                typeof t.id === 'string' &&
                typeof t.name === 'string' &&
                typeof t.color === 'string' &&
                typeof t.createdAt === 'string',
        ).map((t) => ({
            ...t,
            description: typeof t.description === 'string' ? t.description : '',
        }));
    } catch {
        return [];
    }
}

export function saveTeams(teams: PosterTeam[]): void {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

// ─── Poster Entry ─────────────────────────────────────────────────────────────

export type PosterStatus = 'active' | 'removed' | 'pant';

export interface PosterEntry {
    id: string;
    lat: number;
    lng: number;
    accuracy: number | null; // meters
    timestamp: string;       // ISO date-time
    note: string;
    status: PosterStatus;
    teamId: string | null;
    imageDataUrl: string | null;  // base64 data URL from camera/file
    pantAmount: number | null;    // DKK reward for pant removal
    removedAt: string | null;     // ISO date-time when removed
}

const STORAGE_KEY = 'surdej_poster_tracker_entries';

export function loadPosters(): PosterEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as PosterEntry[];
        // Validate and sanitize numeric fields to prevent injection from tampered storage
        return parsed.filter(
            (e) =>
                typeof e.id === 'string' &&
                typeof e.lat === 'number' && isFinite(e.lat) &&
                typeof e.lng === 'number' && isFinite(e.lng) &&
                typeof e.timestamp === 'string',
        ).map((e) => ({
            ...e,
            accuracy: e.accuracy != null && isFinite(Number(e.accuracy)) ? Number(e.accuracy) : null,
            note: typeof e.note === 'string' ? e.note : '',
            status: (['active', 'removed', 'pant'] as PosterStatus[]).includes(e.status)
                ? e.status
                : 'active',
            teamId: typeof e.teamId === 'string' ? e.teamId : null,
            imageDataUrl: typeof e.imageDataUrl === 'string' ? e.imageDataUrl : null,
            pantAmount: e.pantAmount != null && isFinite(Number(e.pantAmount)) ? Number(e.pantAmount) : null,
            removedAt: typeof e.removedAt === 'string' ? e.removedAt : null,
        }));
    } catch {
        return [];
    }
}

export function savePosters(entries: PosterEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Format decimal degrees to a readable string */
export function formatCoords(lat: number, lng: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

/** Build a Google Maps / OpenStreetMap link */
export function buildMapLink(lat: number, lng: number): string {
    return `https://www.openstreetmap.org/?mlat=${Number(lat).toFixed(7)}&mlon=${Number(lng).toFixed(7)}&zoom=18`;
}

/** Default team colors for quick selection */
export const TEAM_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
    '#64748b', '#0ea5e9',
];

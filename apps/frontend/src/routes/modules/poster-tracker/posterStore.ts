/**
 * Shared types and localStorage persistence for the Poster Tracker feature.
 */

export interface PosterEntry {
    id: string;
    lat: number;
    lng: number;
    accuracy: number | null; // meters
    timestamp: string;       // ISO date-time
    note: string;
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

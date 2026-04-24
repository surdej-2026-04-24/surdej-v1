/**
 * Shared types and localStorage persistence for the Digital Køleskab feature.
 */

export interface FridgeItem {
    id: string;
    name: string;
    quantity: string;
    category: string;
    price: string | null;     // price as shown on receipt, null if unknown
    purchasedAt: string;   // ISO date string
    expiresAt: string | null; // ISO date string, null if unknown
    opened: boolean;
    openedAt: string | null; // ISO date string
}

const STORAGE_KEY = 'surdej_food_tracker_items';

export function loadFridgeItems(): FridgeItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as FridgeItem[];
    } catch {
        return [];
    }
}

export function saveFridgeItems(items: FridgeItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Returns number of days until expiry (negative = already expired). */
export function daysUntilExpiry(expiresAt: string): number {
    const exp = new Date(expiresAt).getTime();
    const now = Date.now();
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

export type ExpiryStatus = 'expired' | 'expiring-soon' | 'ok' | 'unknown';

export function getExpiryStatus(item: FridgeItem): ExpiryStatus {
    if (!item.expiresAt) return 'unknown';
    const days = daysUntilExpiry(item.expiresAt);
    if (days < 0) return 'expired';
    if (days <= 3) return 'expiring-soon';
    return 'ok';
}

export const CATEGORY_OPTIONS = [
    'Mejeri',
    'Kød & Fisk',
    'Grøntsager & Frugt',
    'Drikkevarer',
    'Brød & Bagværk',
    'Dåse & Konserves',
    'Frost',
    'Andet',
] as const;

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
    'Slik & Snacks',
    'Andet',
] as const;

export interface ProductSuggestion {
    name: string;
    quantity: string;
    category: string;
}

/** Comprehensive list of common Danish grocery products with typical quantities and categories. */
export const PRODUCT_SUGGESTIONS: ProductSuggestion[] = [
    // Mejeri & Æg
    { name: 'Minimælk 1 L', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Letmælk 1 L', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Sødmælk 1 L', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Skummetmælk 1 L', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Kærnemælk 1 L', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Smør 500g', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Smør 250g', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Piskefløde 38% ½ L', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Cremefraiche 18%', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Cremefraiche 9%', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Skyr naturel', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Yoghurt naturel', quantity: '1 stk', category: 'Mejeri' },
    { name: 'Danbo 45+', quantity: '200g', category: 'Mejeri' },
    { name: 'Havarti', quantity: '200g', category: 'Mejeri' },
    { name: 'Ost i skiver', quantity: '150g', category: 'Mejeri' },
    { name: 'Mozzarella', quantity: '125g', category: 'Mejeri' },
    { name: 'Parmesan', quantity: '100g', category: 'Mejeri' },
    { name: 'Æg 6 stk', quantity: '1 bakke', category: 'Mejeri' },
    { name: 'Æg 10 stk', quantity: '1 bakke', category: 'Mejeri' },
    { name: 'Æg 12 stk', quantity: '1 bakke', category: 'Mejeri' },
    // Kød & Fisk
    { name: 'Kyllingefilet', quantity: '500g', category: 'Kød & Fisk' },
    { name: 'Kyllingelår', quantity: '1 kg', category: 'Kød & Fisk' },
    { name: 'Hakket oksekød 400g', quantity: '1 stk', category: 'Kød & Fisk' },
    { name: 'Hakket oksekød 750g', quantity: '1 stk', category: 'Kød & Fisk' },
    { name: 'Bøf', quantity: '200g', category: 'Kød & Fisk' },
    { name: 'Svinekotelet', quantity: '2 stk', category: 'Kød & Fisk' },
    { name: 'Flæskesteg', quantity: '1 kg', category: 'Kød & Fisk' },
    { name: 'Laks filet', quantity: '300g', category: 'Kød & Fisk' },
    { name: 'Torsk filet', quantity: '400g', category: 'Kød & Fisk' },
    { name: 'Rejer', quantity: '250g', category: 'Kød & Fisk' },
    { name: 'Bacon', quantity: '200g', category: 'Kød & Fisk' },
    { name: 'Leverpostej', quantity: '200g', category: 'Kød & Fisk' },
    { name: 'Skinke', quantity: '100g', category: 'Kød & Fisk' },
    { name: 'Rullepølse', quantity: '100g', category: 'Kød & Fisk' },
    { name: 'Pølser', quantity: '500g', category: 'Kød & Fisk' },
    // Grøntsager & Frugt
    { name: 'Gulerødder 1 kg', quantity: '1 pose', category: 'Grøntsager & Frugt' },
    { name: 'Tomater', quantity: '500g', category: 'Grøntsager & Frugt' },
    { name: 'Agurk', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Løg 1 kg', quantity: '1 pose', category: 'Grøntsager & Frugt' },
    { name: 'Rødløg', quantity: '3 stk', category: 'Grøntsager & Frugt' },
    { name: 'Hvidløg', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Porrer', quantity: '2 stk', category: 'Grøntsager & Frugt' },
    { name: 'Peberfrugt', quantity: '3 stk', category: 'Grøntsager & Frugt' },
    { name: 'Broccoli', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Blomkål', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Isbergsalat', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Spinat', quantity: '150g', category: 'Grøntsager & Frugt' },
    { name: 'Rucola', quantity: '75g', category: 'Grøntsager & Frugt' },
    { name: 'Kartofler 2 kg', quantity: '1 pose', category: 'Grøntsager & Frugt' },
    { name: 'Søde kartofler', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Squash', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Aubergine', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Champignon', quantity: '250g', category: 'Grøntsager & Frugt' },
    { name: 'Selleri', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    { name: 'Banan', quantity: '6 stk', category: 'Grøntsager & Frugt' },
    { name: 'Æbler', quantity: '6 stk', category: 'Grøntsager & Frugt' },
    { name: 'Pærer', quantity: '4 stk', category: 'Grøntsager & Frugt' },
    { name: 'Appelsiner', quantity: '6 stk', category: 'Grøntsager & Frugt' },
    { name: 'Citroner', quantity: '4 stk', category: 'Grøntsager & Frugt' },
    { name: 'Avocado', quantity: '2 stk', category: 'Grøntsager & Frugt' },
    { name: 'Jordbær', quantity: '500g', category: 'Grøntsager & Frugt' },
    { name: 'Blåbær', quantity: '125g', category: 'Grøntsager & Frugt' },
    { name: 'Druer', quantity: '500g', category: 'Grøntsager & Frugt' },
    { name: 'Mango', quantity: '1 stk', category: 'Grøntsager & Frugt' },
    // Drikkevarer
    { name: 'Appelsinjuice 1 L', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Æblejuice 1 L', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Cola 1,5 L', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Cola 6-pak', quantity: '1 pak', category: 'Drikkevarer' },
    { name: 'Fanta 1,5 L', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Sprite 1,5 L', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Sodavand 6-pak', quantity: '1 pak', category: 'Drikkevarer' },
    { name: 'Vand 1,5 L', quantity: '6 stk', category: 'Drikkevarer' },
    { name: 'Energidrik 0,5 L', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Iste 0,5 L', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Kaffe 250g', quantity: '1 stk', category: 'Drikkevarer' },
    { name: 'Te 20 breve', quantity: '1 pakke', category: 'Drikkevarer' },
    { name: 'Carlsberg 6-pak', quantity: '1 pak', category: 'Drikkevarer' },
    { name: 'Tuborg 6-pak', quantity: '1 pak', category: 'Drikkevarer' },
    // Brød & Bagværk
    { name: 'Rugbrød 1,1 kg', quantity: '1 stk', category: 'Brød & Bagværk' },
    { name: 'Franskbrød', quantity: '1 stk', category: 'Brød & Bagværk' },
    { name: 'Grovbrød', quantity: '1 stk', category: 'Brød & Bagværk' },
    { name: 'Toastbrød', quantity: '1 stk', category: 'Brød & Bagværk' },
    { name: 'Knækbrød', quantity: '1 pakke', category: 'Brød & Bagværk' },
    { name: 'Havregryn 500g', quantity: '1 stk', category: 'Brød & Bagværk' },
    { name: 'Müsli', quantity: '1 kg', category: 'Brød & Bagværk' },
    { name: 'Cornflakes', quantity: '375g', category: 'Brød & Bagværk' },
    { name: 'Rundstykker', quantity: '6 stk', category: 'Brød & Bagværk' },
    { name: 'Baguette', quantity: '2 stk', category: 'Brød & Bagværk' },
    { name: 'Croissanter', quantity: '4 stk', category: 'Brød & Bagværk' },
    { name: 'Mel 1 kg', quantity: '1 stk', category: 'Brød & Bagværk' },
    // Dåse & Konserves
    { name: 'Tomater på dåse', quantity: '1 dåse', category: 'Dåse & Konserves' },
    { name: 'Kikærter på dåse', quantity: '1 dåse', category: 'Dåse & Konserves' },
    { name: 'Hvide bønner på dåse', quantity: '1 dåse', category: 'Dåse & Konserves' },
    { name: 'Tun på dåse', quantity: '1 dåse', category: 'Dåse & Konserves' },
    { name: 'Makrel i tomat', quantity: '1 dåse', category: 'Dåse & Konserves' },
    { name: 'Mais på dåse', quantity: '1 dåse', category: 'Dåse & Konserves' },
    { name: 'Grønne linser', quantity: '500g', category: 'Dåse & Konserves' },
    { name: 'Kokosmælk på dåse', quantity: '1 dåse', category: 'Dåse & Konserves' },
    // Frost
    { name: 'Ærter 1 kg (frost)', quantity: '1 pose', category: 'Frost' },
    { name: 'Spinat (frost)', quantity: '750g', category: 'Frost' },
    { name: 'Broccoli (frost)', quantity: '500g', category: 'Frost' },
    { name: 'Pommes frites (frost)', quantity: '1 kg', category: 'Frost' },
    { name: 'Pizza (frost)', quantity: '1 stk', category: 'Frost' },
    { name: 'Fiskefingre (frost)', quantity: '400g', category: 'Frost' },
    { name: 'Vaniljeis 1 L', quantity: '1 stk', category: 'Frost' },
    // Slik & Snacks
    { name: 'Vingummibamser', quantity: '200g', category: 'Slik & Snacks' },
    { name: 'Lakrids', quantity: '200g', category: 'Slik & Snacks' },
    { name: 'Chokolade 100g', quantity: '1 stk', category: 'Slik & Snacks' },
    { name: 'Chips', quantity: '175g', category: 'Slik & Snacks' },
    { name: 'Popcorn', quantity: '80g', category: 'Slik & Snacks' },
    { name: 'Nødder 250g', quantity: '1 pose', category: 'Slik & Snacks' },
    { name: 'Skumfiduser', quantity: '125g', category: 'Slik & Snacks' },
    { name: 'Lakridsstænger', quantity: '4 stk', category: 'Slik & Snacks' },
    { name: 'Kiks', quantity: '1 pakke', category: 'Slik & Snacks' },
    { name: 'Karamel', quantity: '100g', category: 'Slik & Snacks' },
];

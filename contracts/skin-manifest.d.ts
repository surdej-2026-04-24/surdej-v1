/**
 * Skin Manifest Contract
 *
 * A skin defines the sidebar navigation and branding for a specific user experience.
 * Skins reference command IDs — they never hardcode routes or components.
 */

export interface SkinManifest {
    /** Unique skin identifier */
    id: string;

    /** Human-readable skin name */
    name: string;

    /** Branding configuration */
    branding: SkinBranding;

    /** Sidebar navigation items (ordered list of command IDs) */
    sidebar: SkinSidebarItem[];

    /** Theme overrides (CSS custom properties) */
    theme?: Record<string, string>;
}

export interface SkinBranding {
    /** Application title shown in the sidebar header */
    title: string;

    /** Subtitle / tagline */
    subtitle?: string;

    /** Path to logo image */
    logo?: string;

    /** Favicon path */
    favicon?: string;
}

export interface SkinSidebarItem {
    /** Command ID to execute when clicked */
    commandId: string;

    /** Display order */
    order: number;

    /** Group label */
    group?: string;

    /** Divider after this item */
    dividerAfter?: boolean;
}

/**
 * Skin Manifest Contract — type-only re-export
 *
 * @see contracts/skin-manifest.d.ts
 */

export interface SkinManifest {
    id: string;
    name: string;
    branding: SkinBranding;
    sidebar: SkinSidebarItem[];
    theme?: Record<string, string>;
}

export interface SkinBranding {
    title: string;
    subtitle?: string;
    logo?: string;
    favicon?: string;
}

export interface SkinSidebarItem {
    commandId: string;
    order: number;
    group?: string;
    dividerAfter?: boolean;
}

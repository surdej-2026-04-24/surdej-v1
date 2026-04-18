/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
declare module 'virtual:surdej-domains' {
    import type { DomainRegistry } from '@surdej/core';

    export const domainRegistry: DomainRegistry;
    export const domainErrors: Array<{ domain: string; error: string }>;
    const _default: DomainRegistry;
    export default _default;
}

declare module 'virtual:surdej-skins' {
    interface SkinManifest {
        id: string;
        name: string;
        description?: string;
        branding: {
            appName: string;
            logo?: string;
            primaryColor?: string;
            fontFamily?: string;
        };
        sidebar: Array<{ commandId: string; group?: string }>;
        theme?: {
            defaultMode?: 'light' | 'dark';
        };
    }

    export const skinManifests: SkinManifest[];
    export const skinErrors: Array<{ skin: string; error: string }>;
    export const skinRegistry: {
        skins: SkinManifest[];
        generatedAt: string;
        count: number;
    };
    const _default: SkinManifest[];
    export default _default;
}

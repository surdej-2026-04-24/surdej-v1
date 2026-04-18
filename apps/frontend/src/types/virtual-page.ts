/**
 * Virtual Page Types
 *
 * Shared type definitions for the virtual page system.
 */

export interface VirtualPage {
    id: string;
    skinId: string;
    name: string;
    slug: string;
    description?: string;
    source: string;
    compiled?: string;
    compiledAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface VirtualPageListItem {
    id: string;
    skinId: string;
    name: string;
    slug: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CompileError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

export interface RuntimeError {
    message: string;
    stack?: string;
    timestamp: string;
    componentStack?: string;
}

export interface CompileResult {
    success: boolean;
    code?: string;
    errors: CompileError[];
}

// ── Import / Export ──

export interface VirtualPageExport {
    kind: 'VirtualPage';
    version: number;
    exportedAt: string;
    skinId: string;
    page: {
        name: string;
        slug: string;
        description: string;
        source: string;
    };
}

export interface SkinExport {
    kind: 'Skin';
    version: number;
    exportedAt: string;
    skin: {
        name: string;
        description: string;
        branding: Record<string, unknown>;
        sidebar: unknown[];
        activityBar: unknown[];
        theme: Record<string, unknown>;
        virtualPages: Array<{
            name: string;
            slug: string;
            description: string;
            source: string;
        }>;
    };
}

export interface ImportConflict {
    slug: string;
    name: string;
}

export interface ImportDryRunResult {
    dryRun: true;
    total?: number;
    conflicts: ImportConflict[];
    pages?: Array<{
        slug: string;
        name: string;
        hasConflict: boolean;
    }>;
    // Skin-level import
    skinConflict?: { id: string; name: string } | null;
    pageConflicts?: ImportConflict[];
    totalPages?: number;
}

export type ImportResolution = 'overwrite' | 'new' | 'skip';

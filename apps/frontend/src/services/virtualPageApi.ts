/**
 * Virtual Page API Service
 *
 * All API calls for virtual page CRUD and import/export.
 */

import { api } from '@/lib/api';
import YAML from 'yaml';
import type {
    VirtualPage,
    VirtualPageListItem,
    ImportDryRunResult,
    ImportResolution,
} from '@/types/virtual-page';

// ── CRUD ──

export async function listVirtualPages(skinId: string): Promise<VirtualPageListItem[]> {
    return api.get(`/skins/${skinId}/pages`);
}

export async function getVirtualPage(skinId: string, pageId: string): Promise<VirtualPage> {
    return api.get(`/skins/${skinId}/pages/${pageId}`);
}

export async function createVirtualPage(
    skinId: string,
    data: { name: string; slug?: string; description?: string; source: string },
): Promise<VirtualPage> {
    return api.post(`/skins/${skinId}/pages`, data);
}

export async function updateVirtualPage(
    skinId: string,
    pageId: string,
    data: Partial<Pick<VirtualPage, 'name' | 'slug' | 'description' | 'source' | 'compiled' | 'compiledAt'>>,
): Promise<VirtualPage> {
    return api.put(`/skins/${skinId}/pages/${pageId}`, data);
}

export async function deleteVirtualPage(skinId: string, pageId: string): Promise<void> {
    await api.del(`/skins/${skinId}/pages/${pageId}`);
}

// ── Export ──

export async function exportVirtualPage(skinId: string, pageId: string): Promise<string> {
    return api.getRaw(`/skins/${skinId}/pages/${pageId}/export`);
}

export async function exportSkin(skinId: string): Promise<string> {
    return api.getRaw(`/skins/${skinId}/export`);
}

export function downloadYaml(yamlContent: string, filename: string): void {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.yaml') ? filename : `${filename}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Import ──

export async function dryRunPageImport(
    skinId: string,
    yamlContent: string,
): Promise<ImportDryRunResult> {
    return api.postJson(`/skins/${skinId}/pages/import?dryRun=true`, { yaml: yamlContent });
}

export async function importPages(
    skinId: string,
    yamlContent: string,
    resolutions: Record<string, ImportResolution>,
): Promise<{ imported: number; results: Array<{ slug: string; action: string; id?: string }> }> {
    return api.postJson(`/skins/${skinId}/pages/import`, { yaml: yamlContent, resolutions });
}

export async function dryRunSkinImport(yamlContent: string): Promise<ImportDryRunResult> {
    return api.postJson('/skins/import?dryRun=true', { yaml: yamlContent });
}

export async function importSkin(
    yamlContent: string,
    skinResolution: ImportResolution,
    pageResolutions: Record<string, ImportResolution>,
): Promise<{
    skinId: string;
    skinAction: string;
    pages: Array<{ slug: string; action: string; id?: string }>;
}> {
    return api.postJson('/skins/import', { yaml: yamlContent, skinResolution, pageResolutions });
}

/** Parse a YAML string and determine its kind */
export function parseYamlImport(yamlContent: string): {
    kind: 'Skin' | 'VirtualPage' | 'unknown';
    doc: Record<string, unknown>;
} {
    const doc = YAML.parse(yamlContent);
    const kind = doc?.kind === 'Skin' ? 'Skin' : doc?.kind === 'VirtualPage' ? 'VirtualPage' : 'unknown';
    return { kind, doc };
}

/**
 * vite-plugin-surdej-skins
 *
 * Scans src/skins/STAR/manifest.ts at build time and generates
 * a virtual module "virtual:surdej-skins" that exports all
 * discovered skin definitions.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
const VIRTUAL_ID = 'virtual:surdej-skins';
const RESOLVED_ID = '\0virtual:surdej-skins';
export function surdejSkins(options = {}) {
    const skinsDir = options.skinsDir || 'src/skins';
    const verbose = options.verbose !== false;
    let root = '';
    return {
        name: 'vite-plugin-surdej-skins',
        enforce: 'pre',
        configResolved(config) {
            root = config.root;
        },
        resolveId(id) {
            if (id === VIRTUAL_ID)
                return RESOLVED_ID;
        },
        load(id) {
            if (id !== RESOLVED_ID)
                return;
            const fullPath = resolve(root, skinsDir);
            const registry = scanSkins(fullPath, verbose);
            return generateModule(registry);
        },
        configureServer(server) {
            const fullPath = resolve(root, skinsDir);
            if (existsSync(fullPath)) {
                server.watcher.add(fullPath);
            }
        },
        handleHotUpdate(ctx) {
            const fullPath = resolve(root, skinsDir);
            if (ctx.file.startsWith(fullPath) && ctx.file.includes('manifest')) {
                const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
                if (mod) {
                    ctx.server.moduleGraph.invalidateModule(mod);
                    return [mod];
                }
            }
        },
    };
}
function scanSkins(skinsPath, verbose) {
    const registry = {
        skins: [],
        errors: [],
        generatedAt: new Date().toISOString(),
    };
    if (!existsSync(skinsPath)) {
        if (verbose) {
            console.log('[surdej-skins] No skins directory found at ' + skinsPath);
            console.log('[surdej-skins] 0 skin manifests found');
        }
        return registry;
    }
    const entries = readdirSync(skinsPath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_'));
    for (const dir of dirs) {
        const skinPath = join(skinsPath, dir.name);
        const manifestPath = join(skinPath, 'manifest.ts');
        if (!existsSync(manifestPath))
            continue;
        try {
            const manifest = parseSkinManifest(manifestPath, dir.name);
            const errs = validateSkinManifest(manifest);
            if (errs.length > 0) {
                for (const e of errs) {
                    registry.errors.push({ skin: dir.name, error: e });
                    console.error('[surdej-skins] x ' + dir.name + ': ' + e);
                }
                continue;
            }
            registry.skins.push(manifest);
            if (verbose) {
                const sc = manifest.sidebar ? manifest.sidebar.length : 0;
                console.log('[surdej-skins] OK ' + manifest.id + ' "' + manifest.name + '" (' + sc + ' sidebar items)');
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            registry.errors.push({ skin: dir.name, error: msg });
            console.error('[surdej-skins] x ' + dir.name + ': ' + msg);
        }
    }
    if (verbose) {
        let summary = '[surdej-skins] ' + registry.skins.length + ' skin manifests found';
        if (registry.errors.length > 0) {
            summary += ' (' + registry.errors.length + ' errors)';
        }
        console.log(summary);
    }
    return registry;
}
function parseSkinManifest(filePath, dirName) {
    const content = readFileSync(filePath, 'utf-8');
    const id = extractStr(content, 'id') || dirName;
    const name = extractStr(content, 'name') || dirName;
    const description = extractStr(content, 'description');
    const appName = extractStr(content, 'appName') || 'Surdej';
    const logo = extractStr(content, 'logo');
    const primaryColor = extractStr(content, 'primaryColor');
    const fontFamily = extractStr(content, 'fontFamily');
    const defaultMode = extractStr(content, 'defaultMode');
    const sidebar = extractSidebarItems(content);
    const branding = { appName };
    if (logo)
        branding.logo = logo;
    if (primaryColor)
        branding.primaryColor = primaryColor;
    if (fontFamily)
        branding.fontFamily = fontFamily;
    const result = { id, name, branding, sidebar };
    if (description)
        result.description = description;
    if (defaultMode)
        result.theme = { defaultMode };
    return result;
}
function extractStr(content, field) {
    const re = new RegExp(field + ":\\s*['\"]([^'\"]*)['\"]");
    const m = content.match(re);
    return m ? m[1] : undefined;
}
function extractSidebarItems(content) {
    const sidebarMatch = content.match(/sidebar:\s*\[([\s\S]*?)]/);
    if (!sidebarMatch)
        return [];
    const items = [];
    const pattern = /\{\s*commandId:\s*['"]([^'"]+)['"]\s*(?:,\s*group:\s*['"]([^'"]+)['"])?\s*}/g;
    let m;
    while ((m = pattern.exec(sidebarMatch[1])) !== null) {
        const item = { commandId: m[1] };
        if (m[2])
            item.group = m[2];
        items.push(item);
    }
    return items;
}
function validateSkinManifest(manifest) {
    const errors = [];
    if (!manifest.id)
        errors.push('Missing required field: id');
    if (!manifest.name)
        errors.push('Missing required field: name');
    if (!manifest.branding || !manifest.branding.appName) {
        errors.push('Missing required field: branding.appName');
    }
    return errors;
}
function generateModule(registry) {
    const lines = [
        '/** Auto-generated by vite-plugin-surdej-skins. DO NOT EDIT. */',
        '',
        'export const skinManifests = ' + JSON.stringify(registry.skins, null, 2) + ';',
        '',
        'export const skinErrors = ' + JSON.stringify(registry.errors, null, 2) + ';',
        '',
        'export const skinRegistry = {',
        '  skins: skinManifests,',
        '  generatedAt: ' + JSON.stringify(registry.generatedAt) + ',',
        '  count: ' + registry.skins.length + ',',
        '};',
        '',
        'export default skinManifests;',
    ];
    return lines.join('\n');
}
export default surdejSkins;

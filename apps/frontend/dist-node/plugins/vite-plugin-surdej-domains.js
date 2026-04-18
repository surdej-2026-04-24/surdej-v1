/**
 * vite-plugin-surdej-domains
 *
 * Scans src/domains/STAR/manifest.ts at build time, validates each
 * manifest against the DomainManifest contract, and generates a
 * virtual module "virtual:surdej-domains" that exports the full
 * DomainRegistry.
 *
 * Also discovers topology definitions from:
 *   domains/NAME/topologies/STAR.ts
 *   domains/NAME/topologies/STAR.generated.ts
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, join, basename } from 'path';
const VIRTUAL_ID = 'virtual:surdej-domains';
const RESOLVED_ID = '\0virtual:surdej-domains';
export function surdejDomains(options = {}) {
    const domainsDir = options.domainsDir || 'src/domains';
    const verbose = options.verbose !== false;
    let root = '';
    return {
        name: 'vite-plugin-surdej-domains',
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
            const fullPath = resolve(root, domainsDir);
            const registry = scanDomains(fullPath, verbose);
            return generateModule(registry);
        },
        configureServer(server) {
            const fullPath = resolve(root, domainsDir);
            if (existsSync(fullPath)) {
                server.watcher.add(fullPath);
            }
        },
        handleHotUpdate(ctx) {
            const fullPath = resolve(root, domainsDir);
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
function scanDomains(domainsPath, verbose) {
    const registry = {
        domains: [],
        errors: [],
        generatedAt: new Date().toISOString(),
    };
    if (!existsSync(domainsPath)) {
        if (verbose) {
            console.log('[surdej-domains] No domains directory found at ' + domainsPath);
            console.log('[surdej-domains] 0 domain manifests found');
        }
        return registry;
    }
    const entries = readdirSync(domainsPath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_'));
    for (const dir of dirs) {
        const domainPath = join(domainsPath, dir.name);
        const manifestPath = join(domainPath, 'manifest.ts');
        if (!existsSync(manifestPath))
            continue;
        try {
            const manifest = parseManifestFile(manifestPath, dir.name);
            const errs = validateManifest(manifest);
            if (errs.length > 0) {
                for (const e of errs) {
                    registry.errors.push({ domain: dir.name, error: e });
                    console.error('[surdej-domains] x ' + dir.name + ': ' + e);
                }
                continue;
            }
            // Discover topologies
            const topologiesDir = join(domainPath, 'topologies');
            if (existsSync(topologiesDir)) {
                const topoFiles = readdirSync(topologiesDir)
                    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
                const topoRefs = topoFiles.map((file) => ({
                    id: dir.name + '.' + basename(file, '.ts').replace('.generated', ''),
                    file: 'topologies/' + file,
                    generated: file.includes('.generated.'),
                }));
                manifest.topologies = [
                    ...(manifest.topologies || []),
                    ...topoRefs,
                ];
            }
            manifest._manifestPath = manifestPath;
            registry.domains.push(manifest);
            if (verbose) {
                const tc = manifest.topologies ? manifest.topologies.length : 0;
                const cc = manifest.commands ? manifest.commands.length : 0;
                console.log('[surdej-domains] OK ' + manifest.id + ' — ' + cc + ' commands, ' + tc + ' topologies');
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            registry.errors.push({ domain: dir.name, error: msg });
            console.error('[surdej-domains] x ' + dir.name + ': ' + msg);
        }
    }
    if (verbose) {
        let summary = '[surdej-domains] ' + registry.domains.length + ' domain manifests found';
        if (registry.errors.length > 0) {
            summary += ' (' + registry.errors.length + ' errors)';
        }
        console.log(summary);
    }
    return registry;
}
function parseManifestFile(filePath, dirName) {
    const content = readFileSync(filePath, 'utf-8');
    const idMatch = content.match(/id:\s*['"]([^'"]+)['"]/);
    const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
    if (idMatch && nameMatch) {
        return {
            id: idMatch[1],
            name: nameMatch[1],
            description: extractStr(content, 'description'),
            icon: extractStr(content, 'icon'),
            version: extractStr(content, 'version'),
            commands: extractArr(content, 'commands'),
            requiredFeatures: extractArr(content, 'requiredFeatures'),
            dependencies: extractArr(content, 'dependencies'),
            _manifestPath: filePath,
        };
    }
    throw new Error('Cannot parse manifest — no id/name found in ' + filePath);
}
function extractStr(content, field) {
    const re = new RegExp(field + ":\\s*['\"]([^'\"]*)['\"]");
    const m = content.match(re);
    return m ? m[1] : undefined;
}
function extractArr(content, field) {
    const re = new RegExp(field + ':\\s*\\[([^\\]]*)\\]');
    const m = content.match(re);
    if (!m)
        return undefined;
    const items = m[1].match(/['"]([^'"]+)['"]/g);
    return items ? items.map((s) => s.replace(/['"]/g, '')) : undefined;
}
function validateManifest(manifest) {
    const errors = [];
    if (!manifest.id) {
        errors.push('Missing required field: id');
    }
    else if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
        errors.push('Invalid id "' + manifest.id + '" — must be kebab-case');
    }
    if (!manifest.name) {
        errors.push('Missing required field: name');
    }
    return errors;
}
function generateModule(registry) {
    const domains = registry.domains.map((d) => {
        const { _manifestPath: _, ...clean } = d;
        return clean;
    });
    const obj = {
        domains: domains,
        generatedAt: registry.generatedAt,
        count: domains.length,
    };
    const lines = [
        '/** Auto-generated by vite-plugin-surdej-domains. DO NOT EDIT. */',
        '',
        'export const domainRegistry = ' + JSON.stringify(obj, null, 2) + ';',
        '',
        'export const domainErrors = ' + JSON.stringify(registry.errors, null, 2) + ';',
        '',
        'export default domainRegistry;',
    ];
    return lines.join('\n');
}
export default surdejDomains;

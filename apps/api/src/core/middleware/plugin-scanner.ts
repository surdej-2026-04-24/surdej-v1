import type { FastifyInstance } from 'fastify';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 2.15 — Domain Plugin Scanner
 *
 * Auto-discovers apps/api/src/domains/STAR/plugin.ts at startup
 * and registers them as Fastify plugins.
 */
export async function scanDomainPlugins(app: FastifyInstance): Promise<void> {
    const domainsDir = join(__dirname, '..', '..', 'domains');
    let entries: string[] = [];

    try {
        entries = await readdir(domainsDir);
    } catch {
        app.log.info('No domains directory found — skipping plugin scan');
        return;
    }

    let count = 0;
    for (const entry of entries) {
        const pluginPath = join(domainsDir, entry, 'plugin.js');
        try {
            const mod = await import(pluginPath);
            if (mod.default?.register) {
                const plugin = mod.default;
                const prefix = plugin.meta?.prefix ?? '/api/' + entry;
                await app.register(plugin.register, { prefix });
                const name = plugin.meta?.name ?? entry;
                app.log.info('Loaded domain plugin: ' + name);
                count++;
            }
        } catch {
            // Plugin doesn't exist or failed to load — skip silently
        }
    }

    app.log.info(count + ' domain plugin(s) found');
}

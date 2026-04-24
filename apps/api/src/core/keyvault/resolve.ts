import { prisma } from '../../db.js';
import { decryptSecret } from './crypto.js';

/**
 * Resolve the API key for a given endpoint from the keyvault.
 * Falls back to the specified env var if no vault mapping exists.
 *
 * @param tenantId  - The tenant to resolve for
 * @param endpoint  - Module/service identifier (e.g. "core-openai")
 * @param envVar    - The env var name the key maps to (default "API_KEY")
 * @param fallbackEnvVar - If no vault mapping, try this process.env key
 * @returns The decrypted API key string, or undefined
 */
export async function resolveApiKey(
    tenantId: string | undefined,
    endpoint: string,
    envVar = 'API_KEY',
    fallbackEnvVar?: string,
): Promise<string | undefined> {
    if (tenantId) {
        try {
            const mapping = await prisma.endpointKeyMapping.findFirst({
                where: {
                    tenantId,
                    endpoint,
                    envVar,
                    isActive: true,
                },
                orderBy: { priority: 'desc' },
                include: { secret: true },
            });

            if (mapping) {
                const value = decryptSecret({
                    encryptedValue: mapping.secret.encryptedValue,
                    iv: mapping.secret.iv,
                    authTag: mapping.secret.authTag,
                });

                // Fire-and-forget: update lastUsedAt
                prisma.secretVault.update({
                    where: { id: mapping.secret.id },
                    data: { lastUsedAt: new Date() },
                }).catch(() => { /* ignore */ });

                return value;
            }
        } catch {
            // Vault unavailable — fall through to env var
        }
    }

    // Fallback to env var
    if (fallbackEnvVar) return process.env[fallbackEnvVar];
    return undefined;
}

/**
 * Resolve all key mappings for an endpoint into an env-var-like record.
 * E.g. for endpoint "core-openai", returns:
 *   { OPENAI_API_KEY: "sk-...", OPENAI_ORG_ID: "org-..." }
 */
export async function resolveEndpointKeys(
    tenantId: string | undefined,
    endpoint: string,
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    if (!tenantId) return result;

    try {
        const mappings = await prisma.endpointKeyMapping.findMany({
            where: {
                tenantId,
                endpoint,
                isActive: true,
            },
            orderBy: { priority: 'desc' },
            include: { secret: true },
        });

        for (const mapping of mappings) {
            // Only take the first (highest priority) for each envVar
            if (result[mapping.envVar]) continue;

            try {
                result[mapping.envVar] = decryptSecret({
                    encryptedValue: mapping.secret.encryptedValue,
                    iv: mapping.secret.iv,
                    authTag: mapping.secret.authTag,
                });
            } catch {
                // Skip secrets that fail to decrypt
            }
        }

        // Fire-and-forget: update lastUsedAt on all used secrets
        const secretIds = mappings.map(m => m.secretId);
        if (secretIds.length > 0) {
            prisma.secretVault.updateMany({
                where: { id: { in: secretIds } },
                data: { lastUsedAt: new Date() },
            }).catch(() => { /* ignore */ });
        }
    } catch {
        // Vault unavailable
    }

    return result;
}

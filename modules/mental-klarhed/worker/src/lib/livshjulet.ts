import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '../../node_modules/.prisma/mental-klarhed-client/index.js';
import { LIVSHJULET_DIMENSIONS, type DimensionKey } from '@surdej/module-mental-klarhed-shared';

/**
 * Generate a cryptographically secure magic-link token and persist it.
 * @param prisma - Prisma client instance
 * @param clientId - The client's UUID
 * @param purpose - "portal" | "assessment" | "evaluation"
 * @param sessionId - If purpose is "assessment", the session UUID
 * @param ttlDays - Token validity in days (default 7)
 */
export async function generateMagicToken(
    prisma: PrismaClient,
    clientId: string,
    purpose: string,
    sessionId: string | null,
    ttlDays = 7
): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await prisma.magicLink.create({
        data: { clientId, token, purpose, sessionId, expiresAt },
    });

    return token;
}

/**
 * Get a human-readable label for a dimension key in the given locale.
 */
export function getDimensionLabel(key: DimensionKey, locale: 'da' | 'en'): string {
    const dim = LIVSHJULET_DIMENSIONS.find(d => d.key === key);
    if (!dim) return key;
    return locale === 'da' ? dim.da : dim.en;
}

/**
 * Return dimension keys sorted from lowest to highest score.
 */
export function rankDimensions(scores: Record<string, number>): DimensionKey[] {
    return (Object.entries(scores) as [DimensionKey, number][])
        .sort(([, a], [, b]) => a - b)
        .map(([k]) => k);
}

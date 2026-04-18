/**
 * Prisma Client for tool-management-tools module
 *
 * Uses the module-specific schema with its own output path.
 */

import { PrismaClient } from '../node_modules/.prisma/tool-management-tools-client/index.js';

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
    if (!_prisma) {
        _prisma = new PrismaClient({
            log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
        });
    }
    return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
    if (_prisma) {
        await _prisma.$disconnect();
        _prisma = null;
    }
}

export { PrismaClient };

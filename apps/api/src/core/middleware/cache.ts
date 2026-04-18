/**
 * Redis-backed TTL Cache for ACL/RLS lookups.
 *
 * Uses Redis as the primary cache store with automatic JSON serialization.
 * Falls back to in-memory Map if Redis is unavailable (graceful degradation).
 *
 * Cache key prefixes allow efficient invalidation of related entries:
 *   - perm:<tenantId>:*          — permission checks
 *   - teams:<tenantId>:*         — team membership lookups
 *   - policies:<tenantId>:*      — access policy queries
 *   - masks:<tenantId>:*         — field mask rules
 *   - table-access:<tenantId>:*  — table access rules
 *
 * Invalidation:
 *   Call invalidateTenantCaches(tenantId) on ACL mutations.
 *   Call invalidateAllCaches() for global config changes.
 */

import Redis from 'ioredis';

// ─── Redis Connection ───

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_PREFIX = 'surdej:acl:';

let redis: Redis | null = null;
let redisReady = false;

function getRedis(): Redis | null {
    if (redis) return redisReady ? redis : null;

    try {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 1,
            retryStrategy: (times: number) => {
                if (times > 3) return null; // Stop retrying after 3 attempts
                return Math.min(times * 200, 2000);
            },
            lazyConnect: false,
            connectTimeout: 3000,
        });

        redis.on('ready', () => {
            redisReady = true;
            console.log('[Cache] Redis connected:', REDIS_URL);
        });

        redis.on('error', (err: Error) => {
            if (redisReady) {
                console.warn('[Cache] Redis error, falling back to memory:', err.message);
            }
            redisReady = false;
        });

        redis.on('close', () => {
            redisReady = false;
        });

        return null; // Not ready yet on first call
    } catch {
        console.warn('[Cache] Redis unavailable, using in-memory fallback');
        return null;
    }
}

// Initialize connection on module load
getRedis();

// ─── In-Memory Fallback ───

interface MemEntry {
    value: string;
    expiresAt: number;
}

const memStore = new Map<string, MemEntry>();
const MEM_MAX_SIZE = 5_000;

function memGet(key: string): string | null {
    const entry = memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        memStore.delete(key);
        return null;
    }
    return entry.value;
}

function memSet(key: string, value: string, ttlMs: number): void {
    if (memStore.size >= MEM_MAX_SIZE) {
        const firstKey = memStore.keys().next().value;
        if (firstKey) memStore.delete(firstKey);
    }
    memStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memInvalidate(prefix: string): number {
    let count = 0;
    for (const key of memStore.keys()) {
        if (key.startsWith(prefix)) {
            memStore.delete(key);
            count++;
        }
    }
    return count;
}

// ─── Cache Operations ───

export class TtlCache {
    private defaultTtlMs: number;
    private keyPrefix: string;

    constructor(options?: { ttlMs?: number; keyPrefix?: string }) {
        this.defaultTtlMs = options?.ttlMs ?? 60_000;
        this.keyPrefix = CACHE_PREFIX + (options?.keyPrefix ?? '');
    }

    private fullKey(key: string): string {
        return this.keyPrefix + key;
    }

    /**
     * Get a cached value, or compute + cache it if missing/expired.
     */
    async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
        const fk = this.fullKey(key);
        const ttl = ttlMs ?? this.defaultTtlMs;

        // Try Redis first
        const r = getRedis();
        if (r) {
            try {
                const cached = await r.get(fk);
                if (cached !== null) {
                    return JSON.parse(cached) as T;
                }
            } catch {
                // Redis read failed, fall through
            }
        }

        // Try in-memory fallback
        const memCached = memGet(fk);
        if (memCached !== null) {
            return JSON.parse(memCached) as T;
        }

        // Compute value
        const value = await factory();
        const serialized = JSON.stringify(value);

        // Store in Redis
        if (r) {
            try {
                await r.set(fk, serialized, 'PX', ttl);
            } catch {
                // Redis write failed, store in memory only
            }
        }

        // Always store in memory as backup
        memSet(fk, serialized, ttl);

        return value;
    }

    /**
     * Get a cached value (returns undefined if missing/expired).
     */
    async get<T>(key: string): Promise<T | undefined> {
        const fk = this.fullKey(key);

        const r = getRedis();
        if (r) {
            try {
                const cached = await r.get(fk);
                if (cached !== null) return JSON.parse(cached) as T;
            } catch {
                // fall through
            }
        }

        const memCached = memGet(fk);
        if (memCached !== null) return JSON.parse(memCached) as T;
        return undefined;
    }

    /**
     * Set a cache value with optional custom TTL.
     */
    async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const fk = this.fullKey(key);
        const ttl = ttlMs ?? this.defaultTtlMs;
        const serialized = JSON.stringify(value);

        const r = getRedis();
        if (r) {
            try {
                await r.set(fk, serialized, 'PX', ttl);
            } catch {
                // fall through
            }
        }
        memSet(fk, serialized, ttl);
    }

    /**
     * Invalidate entries matching a key prefix.
     * Uses Redis SCAN for safe, non-blocking key deletion.
     */
    async invalidate(keyPrefix: string): Promise<number> {
        const fk = this.fullKey(keyPrefix);
        let count = memInvalidate(fk);

        const r = getRedis();
        if (r) {
            try {
                let cursor = '0';
                do {
                    const [nextCursor, keys] = await r.scan(cursor, 'MATCH', fk + '*', 'COUNT', 100);
                    cursor = nextCursor;
                    if (keys.length > 0) {
                        await r.del(...keys);
                        count += keys.length;
                    }
                } while (cursor !== '0');
            } catch {
                // Redis scan failed
            }
        }

        return count;
    }

    /**
     * Clear all entries with this cache's prefix.
     */
    async invalidateAll(): Promise<void> {
        // Clear memory
        memInvalidate(this.keyPrefix);

        // Clear Redis
        const r = getRedis();
        if (r) {
            try {
                let cursor = '0';
                do {
                    const [nextCursor, keys] = await r.scan(cursor, 'MATCH', this.keyPrefix + '*', 'COUNT', 100);
                    cursor = nextCursor;
                    if (keys.length > 0) {
                        await r.del(...keys);
                    }
                } while (cursor !== '0');
            } catch {
                // Redis scan failed
            }
        }
    }

    /**
     * Get cache stats for debugging.
     */
    stats(): { memSize: number; redisConnected: boolean; ttlMs: number } {
        return {
            memSize: memStore.size,
            redisConnected: redisReady,
            ttlMs: this.defaultTtlMs,
        };
    }
}

// ─── Shared cache instances ───

/** Cache for ACL permission checks (roles + permissions) — 2 min TTL */
export const permissionCache = new TtlCache({ ttlMs: 120_000, keyPrefix: 'perm:' });

/** Cache for RLS lookups (teams, policies, field masks) — 60s TTL */
export const rlsCache = new TtlCache({ ttlMs: 60_000, keyPrefix: 'rls:' });

/** Cache for table access rules — 2 min TTL */
export const tableAccessCache = new TtlCache({ ttlMs: 120_000, keyPrefix: 'tbl:' });

/**
 * Invalidate all caches related to a specific tenant.
 * Call this when ACL mutations happen (role changes, policy updates, etc.)
 */
export async function invalidateTenantCaches(tenantId: string): Promise<void> {
    await Promise.all([
        permissionCache.invalidate(`perm:${tenantId}`),
        rlsCache.invalidate(`teams:${tenantId}`),
        rlsCache.invalidate(`policies:${tenantId}`),
        rlsCache.invalidate(`masks:${tenantId}`),
        tableAccessCache.invalidate(`table-access:${tenantId}`),
    ]);
}

/**
 * Invalidate all caches (nuclear option for global config changes).
 */
export async function invalidateAllCaches(): Promise<void> {
    await Promise.all([
        permissionCache.invalidateAll(),
        rlsCache.invalidateAll(),
        tableAccessCache.invalidateAll(),
    ]);
}

/**
 * Get combined cache stats.
 */
export function getCacheStats() {
    return {
        permission: permissionCache.stats(),
        rls: rlsCache.stats(),
        tableAccess: tableAccessCache.stats(),
        redisUrl: REDIS_URL,
    };
}

/**
 * Gracefully close Redis connection (call on server shutdown).
 */
export async function closeCacheConnection(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
        redisReady = false;
    }
}

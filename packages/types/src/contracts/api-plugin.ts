/**
 * API Plugin Contract — type-only re-export
 *
 * @see contracts/api-plugin.d.ts
 */

export interface DomainPlugin {
    meta: DomainPluginMeta;
    register: (app: unknown) => Promise<void>; // FastifyInstance — kept as unknown to avoid dependency
}

export interface DomainPluginMeta {
    id: string;
    name: string;
    version: string;
    prefix: string;
    schemas?: string[];
    subjects?: string[];
}

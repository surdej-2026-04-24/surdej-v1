import { z } from 'zod';

// ─── Module Identity ───────────────────────────────────────────

export const MODULE_NAME = 'member-nosql';

export const NATS_SUBJECTS = {
    register: 'module.register',
    deregister: 'module.deregister',
    heartbeat: 'module.heartbeat',
    events: 'module.member-nosql.>',
    documentCreated: 'module.member-nosql.document.created',
    documentUpdated: 'module.member-nosql.document.updated',
    documentDeleted: 'module.member-nosql.document.deleted',
} as const;

// ─── Collection Schemas ────────────────────────────────────────

export const CollectionSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string(),
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/, 'Slug must be lowercase alphanumeric with dashes/underscores'),
    description: z.string().optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    schema: z.record(z.unknown()).optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().optional().nullable(),
    createdBy: z.string().optional().nullable(),
    updatedBy: z.string().optional().nullable(),
    _count: z.object({ documents: z.number(), children: z.number() }).optional(),
});

export const CreateCollectionSchema = z.object({
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/),
    description: z.string().optional(),
    parentId: z.string().uuid().optional(),
    schema: z.record(z.unknown()).optional(),
});

export const UpdateCollectionSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    schema: z.record(z.unknown()).optional().nullable(),
});

// ─── Document Schemas ──────────────────────────────────────────

export const DocumentSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string(),
    collectionId: z.string().uuid(),
    data: z.record(z.unknown()),
    version: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().optional().nullable(),
    createdBy: z.string().optional().nullable(),
    updatedBy: z.string().optional().nullable(),
});

export const CreateDocumentSchema = z.object({
    data: z.record(z.unknown()),
});

export const UpdateDocumentSchema = z.object({
    data: z.record(z.unknown()),
});

export const QueryDocumentsSchema = z.object({
    filter: z.record(z.unknown()).optional(),
    sort: z.record(z.enum(['asc', 'desc'])).optional(),
    limit: z.coerce.number().int().positive().max(1000).optional().default(50),
    offset: z.coerce.number().int().nonnegative().optional().default(0),
    includeDeleted: z.coerce.boolean().optional().default(false),
});

// ─── Version Schemas ───────────────────────────────────────────

export const DocumentVersionSchema = z.object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
    version: z.number().int().positive(),
    data: z.record(z.unknown()),
    createdAt: z.string().datetime(),
    createdBy: z.string().optional().nullable(),
});

// ─── Admin / Stats ─────────────────────────────────────────────

export const CollectionStatsSchema = z.object({
    collectionId: z.string().uuid(),
    collectionName: z.string(),
    collectionSlug: z.string(),
    documentCount: z.number(),
    activeDocumentCount: z.number(),
    deletedDocumentCount: z.number(),
    latestUpdatedAt: z.string().datetime().optional().nullable(),
});

// ─── MCP Tool Result ───────────────────────────────────────────

export const McpToolResultSchema = z.object({
    content: z.array(
        z.object({
            type: z.literal('text'),
            text: z.string(),
        })
    ),
    isError: z.boolean().optional(),
});

// ─── Type Exports ──────────────────────────────────────────────

export type Collection = z.infer<typeof CollectionSchema>;
export type CreateCollection = z.infer<typeof CreateCollectionSchema>;
export type UpdateCollection = z.infer<typeof UpdateCollectionSchema>;

export type Document = z.infer<typeof DocumentSchema>;
export type CreateDocument = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>;
export type QueryDocuments = z.infer<typeof QueryDocumentsSchema>;

export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;
export type CollectionStats = z.infer<typeof CollectionStatsSchema>;
export type McpToolResult = z.infer<typeof McpToolResultSchema>;

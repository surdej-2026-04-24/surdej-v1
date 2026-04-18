/**
 * Module: member-example — Zod Schemas
 *
 * These schemas define the contract between the module worker API
 * and any consumer (frontend UI, other modules, tests).
 */

import { z } from 'zod';

// ─── Module Identity ───────────────────────────────────────────

/** Module name — used for NATS registration and API gateway routing. */
export const MODULE_NAME = 'member-example';

/** NATS subjects this module uses. */
export const NATS_SUBJECTS = {
    /** Published by the module worker on startup to register with the core API gateway. */
    REGISTER: 'module.register',
    /** Published by the module worker before shutdown. */
    DEREGISTER: 'module.deregister',
    /** Heartbeat subject — worker publishes periodically. */
    HEARTBEAT: 'module.heartbeat',
} as const;

// ─── Domain Schemas ────────────────────────────────────────────

export const ExampleItemSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    status: z.enum(['draft', 'active', 'archived']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type ExampleItem = z.infer<typeof ExampleItemSchema>;

// ─── Request DTOs ──────────────────────────────────────────────

export const CreateExampleItemSchema = ExampleItemSchema.pick({
    name: true,
    description: true,
}).extend({
    status: z.enum(['draft', 'active']).default('draft'),
});

export type CreateExampleItem = z.infer<typeof CreateExampleItemSchema>;

export const UpdateExampleItemSchema = ExampleItemSchema.pick({
    name: true,
    description: true,
    status: true,
}).partial();

export type UpdateExampleItem = z.infer<typeof UpdateExampleItemSchema>;

// ─── Response DTOs ─────────────────────────────────────────────

export const ExampleItemListResponseSchema = z.object({
    items: z.array(ExampleItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
});

export type ExampleItemListResponse = z.infer<typeof ExampleItemListResponseSchema>;

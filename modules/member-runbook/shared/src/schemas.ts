/**
 * Module: member-runbook — Zod Schemas
 *
 * Shared DTOs for runbooks (AI workflow prompts) and flyer layouts.
 * Used by both the worker (server-side validation) and UI (client-side).
 *
 * Naming conventions:
 *   /surdej-*  → Platform/framework runbooks
 *   /<tenant>-* → Tenant-specific runbooks
 */

import { z } from 'zod';

// ─── Module Identity ───────────────────────────────────────────

export const MODULE_NAME = 'member-runbook';

export const NATS_SUBJECTS = {
    REGISTER: 'module.register',
    DEREGISTER: 'module.deregister',
    HEARTBEAT: 'module.heartbeat',
} as const;

// ─── Tag System ────────────────────────────────────────────────

/** Well-known document tags */
export const DOCUMENT_TAGS = {
    // Blob purpose tags
    PDF_REFINERY: 'pdf-refinery',
    PROSPECT: 'prospect',
    ANALYSIS: 'analysis',
    RUNBOOK: 'runbook',
    RUNBOOK_HERO: 'runbook-hero',
    RUNBOOK_INSIDE: 'runbook-inside',
    KNOWLEDGE: 'knowledge',
    // Runbook category tags
    PLATFORM: 'platform',
    CUSTOMER: 'customer',
    DAILY: 'daily',
    SETUP: 'setup',
    RELEASE: 'release',
    DEVOPS: 'devops',
} as const;

export type DocumentTag = typeof DOCUMENT_TAGS[keyof typeof DOCUMENT_TAGS];

// ─── Runbook Prefix ────────────────────────────────────────────

export const RUNBOOK_PREFIXES = {
    SURDEJ: 'surdej',   // Platform/framework prompts
} as const;

export type RunbookPrefix = typeof RUNBOOK_PREFIXES[keyof typeof RUNBOOK_PREFIXES] | string;

// ─── Flyer Layout Schemas ──────────────────────────────────────

export const BackCoverConfigSchema = z.object({
    logoImagePath: z.string().optional(),
    name: z.string(),
    role: z.string().optional(),
    bio: z.string().optional(),
    contact: z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        location: z.string().optional(),
    }).optional(),
    csrText: z.string().optional(),
    websiteUrl: z.string().optional(),
});

export type BackCoverConfig = z.infer<typeof BackCoverConfigSchema>;

export const FrontCoverConfigSchema = z.object({
    overlayGradient: z.string().optional(),
    titleFontFamily: z.string().default('Space Grotesk'),
    titleFontSize: z.string().default('42px'),
    subtitleStyle: z.string().optional(),
    footerBrandSvg: z.string().optional(),
    footerBrandName: z.string().optional(),
});

export type FrontCoverConfig = z.infer<typeof FrontCoverConfigSchema>;

export const InsideConfigSchema = z.object({
    leftBg: z.string().default('#FAF7F2'),
    rightBg: z.string().default('#FFFFFF'),
    accentColor: z.string().default('#6C7A65'),
    quoteStyle: z.enum(['border-left', 'italic', 'boxed']).default('border-left'),
});

export type InsideConfig = z.infer<typeof InsideConfigSchema>;

export const ColorPaletteSchema = z.object({
    primary: z.string(),       // Main brand color (wood)
    secondary: z.string(),     // Secondary (wheat/bg)
    accent: z.string(),        // Accent (olive/teal)
    background: z.string(),    // Page background
    text: z.string(),          // Primary text
    sand: z.string().optional(),
    stone: z.string().optional(),
});

export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

export const FlyerLayoutSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    scope: z.enum(['common', 'business-unit']).default('common'),
    businessUnit: z.string().nullable().optional(),
    backCoverConfig: BackCoverConfigSchema,
    frontCoverConfig: FrontCoverConfigSchema,
    insideConfig: InsideConfigSchema,
    colorPalette: ColorPaletteSchema,
    typography: z.any().optional(),
    isDefault: z.boolean().default(false),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type FlyerLayout = z.infer<typeof FlyerLayoutSchema>;

export const CreateFlyerLayoutSchema = FlyerLayoutSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type CreateFlyerLayout = z.infer<typeof CreateFlyerLayoutSchema>;

// ─── Runbook Step (metadata) ───────────────────────────────────

export const RunbookStepSchema = z.object({
    number: z.number().int().positive(),
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
});

export type RunbookStep = z.infer<typeof RunbookStepSchema>;

// ─── Runbook Schemas ───────────────────────────────────────────

export const RunbookSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid().nullable().optional(),
    slug: z.string().min(1).max(100),
    prefix: z.string().min(1).max(50),
    title: z.string().min(1).max(255),
    subtitle: z.string().max(255).optional(),
    description: z.string().max(5000).optional(),
    content: z.string(),                // Markdown content
    heroImagePath: z.string().nullable().optional(),
    insideImagePath: z.string().nullable().optional(),
    category: z.enum(['workflow', 'guide', 'reference']).default('workflow'),
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    version: z.string().default('1.0.0'),
    authorId: z.string().nullable().optional(),
    flyerLayoutId: z.string().uuid().nullable().optional(),
    metadata: z.object({
        steps: z.array(RunbookStepSchema).optional(),
        quote: z.string().optional(),
        architectureDiagram: z.string().optional(),
    }).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    // Joined data (optional)
    flyerLayout: FlyerLayoutSchema.optional(),
});

export type Runbook = z.infer<typeof RunbookSchema>;

// ─── Request DTOs ──────────────────────────────────────────────

export const CreateRunbookSchema = z.object({
    slug: z.string().min(1).max(100),
    prefix: z.string().min(1).max(50),
    title: z.string().min(1).max(255),
    subtitle: z.string().max(255).optional(),
    description: z.string().max(5000).optional(),
    content: z.string(),
    category: z.enum(['workflow', 'guide', 'reference']).default('workflow'),
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    version: z.string().default('1.0.0'),
    flyerLayoutId: z.string().uuid().nullable().optional(),
    metadata: z.any().optional(),
});

export type CreateRunbook = z.infer<typeof CreateRunbookSchema>;

export const UpdateRunbookSchema = CreateRunbookSchema.partial();

export type UpdateRunbook = z.infer<typeof UpdateRunbookSchema>;

// ─── Response DTOs ─────────────────────────────────────────────

export const RunbookListResponseSchema = z.object({
    items: z.array(RunbookSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
});

export type RunbookListResponse = z.infer<typeof RunbookListResponseSchema>;

export const FlyerLayoutListResponseSchema = z.object({
    items: z.array(FlyerLayoutSchema),
    total: z.number().int().nonnegative(),
});

export type FlyerLayoutListResponse = z.infer<typeof FlyerLayoutListResponseSchema>;

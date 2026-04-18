import { z } from 'zod';

export const MODULE_NAME = 'member-feedback';

// ─── NATS Subjects ─────────────────────────────────────────────

export const NATS_SUBJECTS = {
    register: 'module.register',
    deregister: 'module.deregister',
    heartbeat: 'module.heartbeat',
    events: `module.${MODULE_NAME}.>`,
    // Ticket-specific
    ticketCreated: `module.${MODULE_NAME}.ticket.created`,
    ticketUpdated: `module.${MODULE_NAME}.ticket.updated`,
    ticketTransitioned: `module.${MODULE_NAME}.ticket.transitioned`,
    analyzeTicket: `module.${MODULE_NAME}.ticket.analyze`,
} as const;

// ─── Enums ─────────────────────────────────────────────────────

export const TicketStatusEnum = z.enum([
    'new',
    'open',
    'in_progress',
    'waiting_customer',
    'waiting_internal',
    'resolved',
    'closed',
    'reopened',
]);
export type TicketStatus = z.infer<typeof TicketStatusEnum>;

export const TicketPriorityEnum = z.enum([
    'critical',
    'high',
    'medium',
    'low',
]);
export type TicketPriority = z.infer<typeof TicketPriorityEnum>;

export const TicketCategoryEnum = z.enum([
    'bug',
    'feature_request',
    'question',
    'complaint',
    'general',
    'security',
    'performance',
]);
export type TicketCategory = z.infer<typeof TicketCategoryEnum>;

// ─── AI Analysis ───────────────────────────────────────────────

export const AiAnalysisSchema = z.object({
    sentiment: z.enum(['positive', 'neutral', 'negative', 'frustrated']),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    suggestedCategory: TicketCategoryEnum,
    suggestedPriority: TicketPriorityEnum,
    suggestedRoute: z.string().describe('Suggested team/person to handle this'),
    nextBestAnswer: z.string().describe('AI-suggested response for the agent'),
    summary: z.string().describe('Brief AI summary of the ticket'),
    keywords: z.array(z.string()),
    confidence: z.number().min(0).max(1),
});
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

// ─── Ticket Comment ────────────────────────────────────────────

export const TicketCommentSchema = z.object({
    id: z.string().uuid(),
    ticketId: z.string().uuid(),
    authorId: z.string().uuid(),
    authorName: z.string().optional(),
    authorEmail: z.string().optional(),
    content: z.string().min(1),
    isInternal: z.boolean().default(false),
    createdAt: z.string().datetime(),
});
export type TicketComment = z.infer<typeof TicketCommentSchema>;

// ─── Ticket Transition ────────────────────────────────────────

export const TicketTransitionSchema = z.object({
    id: z.string().uuid(),
    ticketId: z.string().uuid(),
    fromStatus: TicketStatusEnum,
    toStatus: TicketStatusEnum,
    changedById: z.string().uuid(),
    changedByName: z.string().optional(),
    reason: z.string().optional(),
    aiAnalysis: AiAnalysisSchema.optional(),
    createdAt: z.string().datetime(),
});
export type TicketTransition = z.infer<typeof TicketTransitionSchema>;

// ─── Ticket (primary entity) ──────────────────────────────────

export const TicketSchema = z.object({
    id: z.string().uuid(),
    ticketNumber: z.string().describe('Human-readable ticket number, e.g. FB-0001'),
    title: z.string().min(1),
    description: z.string().optional(),
    status: TicketStatusEnum,
    priority: TicketPriorityEnum,
    category: TicketCategoryEnum,
    // Relations
    reporterId: z.string().uuid(),
    reporterName: z.string().optional(),
    reporterEmail: z.string().optional(),
    assigneeId: z.string().uuid().optional(),
    assigneeName: z.string().optional(),
    // Feedback session link
    feedbackSessionId: z.string().uuid().optional(),
    // AI
    aiAnalysis: AiAnalysisSchema.optional(),
    // Metadata
    tags: z.array(z.string()).default([]),
    customerUrl: z.string().optional().describe('Public URL for customer to track ticket'),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    resolvedAt: z.string().datetime().optional(),
    closedAt: z.string().datetime().optional(),
});
export type Ticket = z.infer<typeof TicketSchema>;

// ─── Create / Update DTOs ─────────────────────────────────────

export const CreateTicketSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: TicketPriorityEnum.optional().default('medium'),
    category: TicketCategoryEnum.optional().default('general'),
    feedbackSessionId: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
});
export type CreateTicket = z.infer<typeof CreateTicketSchema>;

export const UpdateTicketSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    priority: TicketPriorityEnum.optional(),
    category: TicketCategoryEnum.optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    tags: z.array(z.string()).optional(),
});
export type UpdateTicket = z.infer<typeof UpdateTicketSchema>;

export const TransitionTicketSchema = z.object({
    toStatus: TicketStatusEnum,
    reason: z.string().optional(),
});
export type TransitionTicket = z.infer<typeof TransitionTicketSchema>;

export const CreateCommentSchema = z.object({
    content: z.string().min(1),
    isInternal: z.boolean().optional().default(false),
});
export type CreateComment = z.infer<typeof CreateCommentSchema>;

// ─── List / response DTOs ─────────────────────────────────────

export const TicketListResponseSchema = z.object({
    items: z.array(TicketSchema),
    total: z.number(),
});
export type TicketListResponse = z.infer<typeof TicketListResponseSchema>;

// ─── Status transition rules ──────────────────────────────────

export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    new: ['open', 'in_progress', 'closed'],
    open: ['in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed'],
    in_progress: ['waiting_customer', 'waiting_internal', 'resolved', 'closed'],
    waiting_customer: ['open', 'in_progress', 'resolved', 'closed'],
    waiting_internal: ['open', 'in_progress', 'resolved', 'closed'],
    resolved: ['closed', 'reopened'],
    closed: ['reopened'],
    reopened: ['open', 'in_progress', 'closed'],
};

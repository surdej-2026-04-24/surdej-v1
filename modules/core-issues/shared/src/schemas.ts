import { z } from 'zod';

export const MODULE_NAME = 'core-issues';

// ─── NATS Subjects ─────────────────────────────────────────────

export const NATS_SUBJECTS = {
    register: 'module.register',
    deregister: 'module.deregister',
    heartbeat: 'module.heartbeat',
    events: `module.${MODULE_NAME}.>`,
    // Issue lifecycle
    issueCreated: `module.${MODULE_NAME}.issue.created`,
    issueUpdated: `module.${MODULE_NAME}.issue.updated`,
    issueArchived: `module.${MODULE_NAME}.issue.archived`,
    issueRestored: `module.${MODULE_NAME}.issue.restored`,
    // Audit
    issueEvent: `module.${MODULE_NAME}.event`,
    // Mentions
    userMentioned: `module.${MODULE_NAME}.mention`,
} as const;

// ─── Enums ─────────────────────────────────────────────────────

export const IssueStatusEnum = z.enum(['open', 'in_progress', 'closed']);
export type IssueStatus = z.infer<typeof IssueStatusEnum>;

export const IssuePriorityEnum = z.enum(['low', 'medium', 'high']);
export type IssuePriority = z.infer<typeof IssuePriorityEnum>;

export const IssueEventTypeEnum = z.enum([
    'created',
    'edited',
    'status_changed',
    'priority_changed',
    'assigned',
    'unassigned',
    'label_added',
    'label_removed',
    'commented',
    'archived',
    'restored',
    'due_date_set',
]);
export type IssueEventType = z.infer<typeof IssueEventTypeEnum>;

// ─── Issue ─────────────────────────────────────────────────────

export const IssueSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    status: IssueStatusEnum.default('open'),
    priority: IssuePriorityEnum.default('medium'),
    assigneeIds: z.array(z.string().uuid()).default([]),
    labelIds: z.array(z.string().uuid()).default([]),
    dueDate: z.string().datetime().nullable().default(null),
    archivedAt: z.string().datetime().nullable().default(null),
    imageAnalysisEnabled: z.boolean().default(true),
    shareWithHappyMates: z.boolean().default(false),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const CreateIssueSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    status: IssueStatusEnum.optional().default('open'),
    priority: IssuePriorityEnum.optional().default('medium'),
    assigneeIds: z.array(z.string().uuid()).optional().default([]),
    labelIds: z.array(z.string().uuid()).optional().default([]),
    dueDate: z.string().datetime().nullable().optional().default(null),
    shareWithHappyMates: z.boolean().optional().default(false),
});
export type CreateIssue = z.infer<typeof CreateIssueSchema>;

export const UpdateIssueSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: IssueStatusEnum.optional(),
    priority: IssuePriorityEnum.optional(),
    dueDate: z.string().datetime().nullable().optional(),
});
export type UpdateIssue = z.infer<typeof UpdateIssueSchema>;

// ─── Comment ───────────────────────────────────────────────────

export const CommentSchema = z.object({
    id: z.string().uuid(),
    issueId: z.string().uuid(),
    authorId: z.string().uuid(),
    body: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentSchema = CommentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export type CreateComment = z.infer<typeof CreateCommentSchema>;

// ─── Label ─────────────────────────────────────────────────────

export const LabelSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    description: z.string().optional(),
});
export type Label = z.infer<typeof LabelSchema>;

export const CreateLabelSchema = LabelSchema.omit({ id: true });
export type CreateLabel = z.infer<typeof CreateLabelSchema>;

export const UpdateLabelSchema = CreateLabelSchema.partial();
export type UpdateLabel = z.infer<typeof UpdateLabelSchema>;

// ─── Issue Event (Audit Trail) ─────────────────────────────────

export const IssueEventSchema = z.object({
    id: z.string().uuid(),
    issueId: z.string().uuid(),
    actorId: z.string().uuid(),
    eventType: IssueEventTypeEnum,
    oldValue: z.string().nullable().default(null),
    newValue: z.string().nullable().default(null),
    createdAt: z.string().datetime(),
});
export type IssueEvent = z.infer<typeof IssueEventSchema>;

// ─── Filtering & Pagination ───────────────────────────────────

export const IssueFilterSchema = z.object({
    status: IssueStatusEnum.optional(),
    priority: IssuePriorityEnum.optional(),
    assignee: z.string().uuid().optional(),
    label: z.string().uuid().optional(),
    q: z.string().optional(),
    dueBefore: z.string().datetime().optional(),
    dueAfter: z.string().datetime().optional(),
    includeArchived: z.coerce.boolean().default(false),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type IssueFilter = z.infer<typeof IssueFilterSchema>;

export const PaginatedIssueListSchema = z.object({
    items: z.array(IssueSchema),
    total: z.number(),
    nextCursor: z.string().uuid().nullable(),
});
export type PaginatedIssueList = z.infer<typeof PaginatedIssueListSchema>;

// ─── Assign ────────────────────────────────────────────────────

export const AssignIssueSchema = z.object({
    assigneeIds: z.array(z.string().uuid()),
});
export type AssignIssue = z.infer<typeof AssignIssueSchema>;

// ─── Image Analysis ────────────────────────────────────────────

export const DetectedRegionSchema = z.object({
    label: z.string(),
    confidence: z.number().min(0).max(1),
    bbox: z.object({
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
    }),
});
export type DetectedRegion = z.infer<typeof DetectedRegionSchema>;

export const ImageAnalysisResultSchema = z.object({
    detections: z.array(DetectedRegionSchema),
    redactedImageUrl: z.string().optional(),
});
export type ImageAnalysisResult = z.infer<typeof ImageAnalysisResultSchema>;

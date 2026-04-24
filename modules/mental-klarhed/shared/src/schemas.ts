import { z } from 'zod';

export const MODULE_NAME = 'mental-klarhed';

// ─── NATS Subjects ─────────────────────────────────────────────

export const NATS_SUBJECTS = {
    register: 'module.register',
    deregister: 'module.deregister',
    heartbeat: 'module.heartbeat',
    events: `module.${MODULE_NAME}.>`,
    assessmentCompleted: `module.${MODULE_NAME}.assessment.completed`,
    materialGenerated: `module.${MODULE_NAME}.material.generated`,
} as const;

// ─── Enums ─────────────────────────────────────────────────────

export const ProgrammeStatusEnum = z.enum(['INVITED', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export type ProgrammeStatus = z.infer<typeof ProgrammeStatusEnum>;

export const SessionStatusEnum = z.enum([
    'PENDING',
    'ASSESSMENT_SENT',
    'ASSESSMENT_DONE',
    'MATERIAL_GENERATED',
    'MATERIAL_SENT',
    'COMPLETED',
]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

// ─── Livshjulet ────────────────────────────────────────────────

export const LIVSHJULET_DIMENSIONS = [
    { key: 'helbred', da: 'Helbred', en: 'Health & Wellbeing' },
    { key: 'familie', da: 'Familie', en: 'Family' },
    { key: 'relationer', da: 'Relationer', en: 'Relationships' },
    { key: 'karriere', da: 'Karriere / Arbejde', en: 'Career / Work' },
    { key: 'oekonomi', da: 'Økonomi', en: 'Finances' },
    { key: 'personligUdvikling', da: 'Personlig udvikling', en: 'Personal Growth' },
    { key: 'fritid', da: 'Fritid', en: 'Leisure & Fun' },
    { key: 'omgivelser', da: 'Omgivelser', en: 'Home & Environment' },
] as const;

export type DimensionKey = typeof LIVSHJULET_DIMENSIONS[number]['key'];

export const LivshjuletScoresSchema = z.object({
    helbred: z.number().int().min(1).max(10),
    familie: z.number().int().min(1).max(10),
    relationer: z.number().int().min(1).max(10),
    karriere: z.number().int().min(1).max(10),
    oekonomi: z.number().int().min(1).max(10),
    personligUdvikling: z.number().int().min(1).max(10),
    fritid: z.number().int().min(1).max(10),
    omgivelser: z.number().int().min(1).max(10),
});
export type LivshjuletScores = z.infer<typeof LivshjuletScoresSchema>;

export const LivshjuletNotesSchema = z.object({
    helbred: z.string().max(500).optional(),
    familie: z.string().max(500).optional(),
    relationer: z.string().max(500).optional(),
    karriere: z.string().max(500).optional(),
    oekonomi: z.string().max(500).optional(),
    personligUdvikling: z.string().max(500).optional(),
    fritid: z.string().max(500).optional(),
    omgivelser: z.string().max(500).optional(),
});
export type LivshjuletNotes = z.infer<typeof LivshjuletNotesSchema>;

// ─── Client ────────────────────────────────────────────────────

export const ClientSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().min(1),
    locale: z.enum(['da', 'en']).default('da'),
    consentAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Client = z.infer<typeof ClientSchema>;

export const CreateClientSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    locale: z.enum(['da', 'en']).default('da'),
});
export type CreateClient = z.infer<typeof CreateClientSchema>;

// ─── Programme ─────────────────────────────────────────────────

export const SessionSummarySchema = z.object({
    id: z.string().uuid(),
    sessionNumber: z.number().int().min(1).max(5),
    scheduledAt: z.string().datetime().nullable(),
    status: SessionStatusEnum,
    hasAssessment: z.boolean(),
    hasMaterial: z.boolean(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const ProgrammeSchema = z.object({
    id: z.string().uuid(),
    clientId: z.string().uuid(),
    clientName: z.string(),
    clientEmail: z.string().email(),
    status: ProgrammeStatusEnum,
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    sessions: z.array(SessionSummarySchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Programme = z.infer<typeof ProgrammeSchema>;

export const CreateProgrammeSchema = z.object({
    client: CreateClientSchema,
    scheduledDates: z.array(z.string().datetime()).max(5).optional(),
});
export type CreateProgramme = z.infer<typeof CreateProgrammeSchema>;

export const ProgrammeListResponseSchema = z.object({
    items: z.array(ProgrammeSchema),
    total: z.number(),
});
export type ProgrammeListResponse = z.infer<typeof ProgrammeListResponseSchema>;

// ─── Assessment ────────────────────────────────────────────────

export const AssessmentSchema = z.object({
    id: z.string().uuid(),
    programmeId: z.string().uuid(),
    sessionId: z.string().uuid().nullable(),
    isInitial: z.boolean(),
    isFinal: z.boolean(),
    scores: LivshjuletScoresSchema,
    notes: LivshjuletNotesSchema,
    completedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const SubmitAssessmentSchema = z.object({
    scores: LivshjuletScoresSchema,
    notes: LivshjuletNotesSchema,
    consentGiven: z.boolean().refine(v => v === true, {
        message: 'Samtykke er påkrævet / Consent is required',
    }),
});
export type SubmitAssessment = z.infer<typeof SubmitAssessmentSchema>;

// ─── Pre-session Material ──────────────────────────────────────

export const PreSessionMaterialSchema = z.object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    pdfContent: z.string(),
    pdfUrl: z.string().nullable(),
    videoScript: z.string(),
    generatedAt: z.string().datetime(),
    sentAt: z.string().datetime().nullable(),
});
export type PreSessionMaterial = z.infer<typeof PreSessionMaterialSchema>;

// ─── Client Portal (returned by magic-link auth) ───────────────

export const ClientPortalStateSchema = z.object({
    clientId: z.string().uuid(),
    clientName: z.string(),
    locale: z.enum(['da', 'en']),
    programme: z.object({
        id: z.string().uuid(),
        status: ProgrammeStatusEnum,
        currentSessionNumber: z.number().int(),
        sessions: z.array(SessionSummarySchema),
    }),
    pendingAssessment: z.object({
        sessionId: z.string().uuid(),
        sessionNumber: z.number().int(),
        isFinal: z.boolean(),
    }).nullable(),
});
export type ClientPortalState = z.infer<typeof ClientPortalStateSchema>;

// ─── Evaluation ────────────────────────────────────────────────

export const EvaluationSchema = z.object({
    initial: AssessmentSchema,
    final: AssessmentSchema,
    deltas: LivshjuletScoresSchema,   // final - initial per dimension
    biggestGains: z.array(z.string()), // top-3 dimension keys
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

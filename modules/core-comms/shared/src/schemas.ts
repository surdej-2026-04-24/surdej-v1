import { z } from 'zod';

export const MODULE_NAME = 'core-comms';

// ─── NATS Subjects ─────────────────────────────────────────────

export const NATS_SUBJECTS = {
    register: 'module.register',
    deregister: 'module.deregister',
    heartbeat: 'module.heartbeat',
    events: `module.${MODULE_NAME}.>`,

    // Send commands (published by API → consumed by worker)
    sendEmail: `module.${MODULE_NAME}.send.email`,
    sendSms: `module.${MODULE_NAME}.send.sms`,
    sendWebhook: `module.${MODULE_NAME}.send.webhook`,

    // Inbound webhook (published by webhook-receiver → consumed by worker)
    // Uses separate prefix to avoid overlap with MODULES stream (module.>)
    webhookInbound: `comms-webhook.${MODULE_NAME}.inbound`,

    // Status events
    communicationSent: `module.${MODULE_NAME}.communication.sent`,
    communicationFailed: `module.${MODULE_NAME}.communication.failed`,
} as const;

// ─── NATS JetStream stream for durable webhook buffering ───────
export const JETSTREAM_CONFIG = {
    streamName: 'CORE_COMMS_WEBHOOKS',
    subjects: [`comms-webhook.${MODULE_NAME}.inbound`],
    consumerName: 'core-comms-webhook-processor',
} as const;

// ─── Channel Enum ──────────────────────────────────────────────

export const ChannelEnum = z.enum(['email', 'sms', 'webhook_outbound', 'webhook_inbound']);
export type Channel = z.infer<typeof ChannelEnum>;

// ─── Communication Status ──────────────────────────────────────

export const CommunicationStatusEnum = z.enum([
    'pending',
    'sent',
    'delivered',
    'failed',
    'bounced',
    'received',
]);
export type CommunicationStatus = z.infer<typeof CommunicationStatusEnum>;

// ─── Communication Direction ───────────────────────────────────

export const DirectionEnum = z.enum(['outbound', 'inbound']);
export type Direction = z.infer<typeof DirectionEnum>;

// ─── Communication Log Entry ───────────────────────────────────

export const CommunicationSchema = z.object({
    id: z.string().uuid(),
    channel: ChannelEnum,
    direction: DirectionEnum,
    status: CommunicationStatusEnum,

    // Who initiated this communication
    initiatorId: z.string(),
    initiatorType: z.string().optional(), // e.g. 'user', 'system', 'webhook'

    // Recipient / source
    recipient: z.string().optional(),  // email address, phone number, or webhook URL
    sender: z.string().optional(),

    // Content
    subject: z.string().optional(),
    body: z.string().optional(),
    metadata: z.record(z.unknown()).optional(), // provider-specific data

    // Provider response
    providerMessageId: z.string().optional(),
    providerResponse: z.record(z.unknown()).optional(),
    errorMessage: z.string().optional(),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Communication = z.infer<typeof CommunicationSchema>;

// ─── Send Email DTO ────────────────────────────────────────────

export const SendEmailSchema = z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1),
    body: z.string().min(1),
    html: z.boolean().optional().default(true),
    initiatorId: z.string(),
    initiatorType: z.string().optional().default('user'),
    metadata: z.record(z.unknown()).optional(),
});
export type SendEmail = z.infer<typeof SendEmailSchema>;

// ─── Send SMS DTO ──────────────────────────────────────────────

export const SendSmsSchema = z.object({
    to: z.string().min(1), // phone number
    message: z.string().min(1),
    initiatorId: z.string(),
    initiatorType: z.string().optional().default('user'),
    metadata: z.record(z.unknown()).optional(),
});
export type SendSms = z.infer<typeof SendSmsSchema>;

// ─── Send Outbound Webhook DTO ─────────────────────────────────

export const SendWebhookSchema = z.object({
    url: z.string().url(),
    method: z.enum(['POST', 'PUT', 'PATCH']).optional().default('POST'),
    headers: z.record(z.string()).optional(),
    payload: z.record(z.unknown()),
    initiatorId: z.string(),
    initiatorType: z.string().optional().default('system'),
    metadata: z.record(z.unknown()).optional(),
});
export type SendWebhook = z.infer<typeof SendWebhookSchema>;

// ─── Inbound Webhook Event (buffered via NATS) ────────────────

export const WebhookInboundEventSchema = z.object({
    channelId: z.string(),       // identifies which webhook endpoint received it
    receivedAt: z.string().datetime(),
    headers: z.record(z.string()),
    body: z.unknown(),
    sourceIp: z.string().optional(),
    method: z.string(),
    path: z.string(),
});
export type WebhookInboundEvent = z.infer<typeof WebhookInboundEventSchema>;

// ─── Webhook Endpoint Registration ─────────────────────────────

export const WebhookEndpointSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    secret: z.string().optional(),  // for HMAC verification
    isActive: z.boolean().default(true),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export const CreateWebhookEndpointSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    secret: z.string().optional(),
});
export type CreateWebhookEndpoint = z.infer<typeof CreateWebhookEndpointSchema>;

// ─── Communication List Response ───────────────────────────────

export const CommunicationListResponseSchema = z.object({
    items: z.array(CommunicationSchema),
    total: z.number(),
});
export type CommunicationListResponse = z.infer<typeof CommunicationListResponseSchema>;

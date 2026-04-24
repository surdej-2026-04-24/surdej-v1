import type { NatsConnection, Codec } from 'nats';
import { AckPolicy } from 'nats';
import {
    NATS_SUBJECTS,
    JETSTREAM_CONFIG,
    WebhookInboundEventSchema,
} from '@surdej/module-core-comms-shared';
import { prisma } from './db.js';

let nc: NatsConnection;
let codec: Codec<unknown>;

export function setNatsConnection(connection: NatsConnection, c: Codec<unknown>) {
    nc = connection;
    codec = c;
}

/**
 * Subscribe to inbound webhook events from NATS JetStream.
 * The webhook-receiver worker publishes events here; this worker
 * persists them and logs the communication.
 */
export async function startWebhookConsumer() {
    if (!nc) {
        console.warn('NATS not connected — skipping webhook consumer');
        return;
    }

    try {
        const jsm = await nc.jetstreamManager();

        // Ensure the stream exists (idempotent)
        let streamExists = false;
        try {
            await jsm.streams.info(JETSTREAM_CONFIG.streamName);
            streamExists = true;
            console.log(`JetStream stream ${JETSTREAM_CONFIG.streamName} already exists`);
        } catch {
            // Stream doesn't exist, create it
        }

        if (!streamExists) {
            try {
                await jsm.streams.add({
                    name: JETSTREAM_CONFIG.streamName,
                    subjects: [...JETSTREAM_CONFIG.subjects],
                });
                console.log(`JetStream stream ${JETSTREAM_CONFIG.streamName} created`);
            } catch (err: unknown) {
                console.error('Failed to create JetStream stream:', err);
                return;
            }
        }

        // Ensure the durable consumer exists (use ordered consumer with durable name)
        try {
            await jsm.consumers.add(JETSTREAM_CONFIG.streamName, {
                durable_name: JETSTREAM_CONFIG.consumerName,
                ack_policy: AckPolicy.Explicit,
            });
            console.log(`JetStream consumer ${JETSTREAM_CONFIG.consumerName} created`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('already') || message.includes('in use')) {
                console.log(`JetStream consumer ${JETSTREAM_CONFIG.consumerName} already exists`);
            } else {
                console.error('Failed to create JetStream consumer:', err);
                return;
            }
        }

        const js = nc.jetstream();
        const consumer = await js.consumers.get(
            JETSTREAM_CONFIG.streamName,
            JETSTREAM_CONFIG.consumerName,
        );

        const messages = await consumer.consume();

        (async () => {
            for await (const msg of messages) {
                try {
                    const data = codec.decode(msg.data);
                    const parsed = WebhookInboundEventSchema.safeParse(data);

                    if (!parsed.success) {
                        console.error('Invalid webhook event:', parsed.error.issues);
                        msg.nak();
                        continue;
                    }

                    const event = parsed.data;

                    // Persist webhook event
                    await prisma.webhookEvent.create({
                        data: {
                            endpointId: event.channelId,
                            headers: event.headers as Record<string, unknown>,
                            body: event.body as Record<string, unknown> | null,
                            sourceIp: event.sourceIp,
                            method: event.method,
                            path: event.path,
                            receivedAt: new Date(event.receivedAt),
                            status: 'processed',
                            processedAt: new Date(),
                        },
                    });

                    // Log as inbound communication
                    await prisma.communication.create({
                        data: {
                            channel: 'webhook_inbound',
                            direction: 'inbound',
                            status: 'received',
                            initiatorId: event.sourceIp ?? 'unknown',
                            initiatorType: 'webhook',
                            sender: event.sourceIp,
                            body: typeof event.body === 'string'
                                ? event.body
                                : JSON.stringify(event.body),
                            metadata: {
                                channelId: event.channelId,
                                method: event.method,
                                path: event.path,
                                headers: event.headers,
                            },
                        },
                    });

                    msg.ack();
                } catch (err) {
                    console.error('Error processing webhook event:', err);
                    msg.nak();
                }
            }
        })();

        console.log('Webhook inbound consumer started');
    } catch (err) {
        console.error('Failed to start webhook consumer:', err);
        console.warn('Webhook consumer will not process inbound events. Outbound communications still work.');
    }
}

/**
 * Audit Trail Service
 *
 * Every mutation on an Issue emits an IssueEvent that is:
 *   1. Persisted to the database (IssueEvent table)
 *   2. Published via NATS for downstream consumers (Activity Log, Notifications)
 *
 * Usage:
 *   import { emitEvent, setNatsConnection } from './services/auditTrail.js';
 *   await emitEvent('issue-uuid', 'actor-uuid', 'status_changed', 'open', 'closed');
 */

import type { NatsConnection, Codec } from 'nats';
import type { IssueEventType } from '@surdej/module-core-issues-shared';
import { NATS_SUBJECTS } from '@surdej/module-core-issues-shared';

// ─── In-memory store (swap for Prisma after migration) ──────────

const eventStore: Array<{
    id: string;
    issueId: string;
    actorId: string;
    eventType: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
}> = [];

// ─── NATS reference (set from server.ts after connect) ─────────

let nc: NatsConnection | null = null;
let codec: Codec<unknown> | null = null;

export function setNatsConnection(connection: NatsConnection, jsonCodec: Codec<unknown>) {
    nc = connection;
    codec = jsonCodec;
}

// ─── Core Function ─────────────────────────────────────────────

/**
 * Emit an audit event for an issue.
 * Inserts into the event store and publishes via NATS.
 *
 * @param issueId  - UUID of the affected issue
 * @param actorId  - UUID of the user who performed the action
 * @param eventType - One of the IssueEventType enum values
 * @param oldValue  - Previous value (optional, e.g. old status)
 * @param newValue  - New value (optional, e.g. new status)
 */
export async function emitEvent(
    issueId: string,
    actorId: string,
    eventType: IssueEventType,
    oldValue?: string | null,
    newValue?: string | null,
): Promise<void> {
    const event = {
        id: crypto.randomUUID(),
        issueId,
        actorId,
        eventType,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        createdAt: new Date().toISOString(),
    };

    // 1. Persist to store
    eventStore.push(event);

    // TODO: Replace with Prisma after migration:
    // await prisma.issueEvent.create({ data: event });

    console.log(`[AuditTrail] ${eventType} on issue ${issueId.substring(0, 8)}… by ${actorId.substring(0, 8)}…`);

    // 2. Publish via NATS
    if (nc && codec) {
        try {
            nc.publish(
                `${NATS_SUBJECTS.issueEvent}.${eventType}`,
                codec.encode(event) as Uint8Array,
            );
        } catch (err) {
            console.error('[AuditTrail] Failed to publish NATS event:', err);
        }
    }
}

/**
 * Retrieve all events for a specific issue (for the history endpoint).
 */
export function getEventsForIssue(issueId: string) {
    return eventStore
        .filter(e => e.issueId === issueId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * @Mention Parser Service
 *
 * Extracts @username tokens from Markdown text and emits NATS
 * notification events for each mentioned user.
 *
 * Usage:
 *   import { extractMentions, notifyMentions } from './services/mentionParser.js';
 *
 *   const usernames = extractMentions(markdownText);
 *   await notifyMentions(usernames, issueId, actorId);
 */

import type { NatsConnection, Codec } from 'nats';
import { NATS_SUBJECTS } from '@surdej/module-core-issues-shared';

// ─── NATS reference (set from server.ts) ───────────────────────

let nc: NatsConnection | null = null;
let codec: Codec<unknown> | null = null;

export function setNatsConnection(connection: NatsConnection, jsonCodec: Codec<unknown>) {
    nc = connection;
    codec = jsonCodec;
}

// ─── Mention Regex ─────────────────────────────────────────────

const MENTION_REGEX = /@([a-zA-Z0-9_-]+)/g;

/**
 * Extract all @username mentions from a Markdown string.
 * Returns a deduplicated array of usernames (without the @ prefix).
 */
export function extractMentions(text: string): string[] {
    if (!text) return [];

    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = MENTION_REGEX.exec(text)) !== null) {
        matches.push(match[1]);
    }

    // Deduplicate
    return [...new Set(matches)];
}

/**
 * Publish NATS notification events for each mentioned username.
 *
 * The calling route handler should resolve usernames → user IDs
 * before calling this, or pass usernames for downstream resolution.
 *
 * @param usernames - Array of mentioned usernames
 * @param issueId   - The issue where the mention occurred
 * @param actorId   - The user who wrote the mention
 * @param context   - 'description' or 'comment' to indicate where the mention was
 */
export async function notifyMentions(
    usernames: string[],
    issueId: string,
    actorId: string,
    context: 'description' | 'comment' = 'description',
): Promise<void> {
    if (!nc || !codec || usernames.length === 0) return;

    for (const username of usernames) {
        try {
            nc.publish(
                NATS_SUBJECTS.userMentioned,
                codec.encode({
                    username,
                    issueId,
                    actorId,
                    context,
                    timestamp: new Date().toISOString(),
                }) as Uint8Array,
            );
            console.log(`[MentionParser] Notified @${username} (issue ${issueId.substring(0, 8)}…)`);
        } catch (err) {
            console.error(`[MentionParser] Failed to notify @${username}:`, err);
        }
    }
}

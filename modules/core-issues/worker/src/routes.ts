import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import {
    CreateIssueSchema,
    UpdateIssueSchema,
    IssueFilterSchema,
    AssignIssueSchema,
    CreateCommentSchema,
    CreateLabelSchema,
    UpdateLabelSchema,
    type Issue,
    type Comment,
    type Label,
} from '@surdej/module-core-issues-shared';
import { emitEvent, getEventsForIssue } from './services/auditTrail.js';
import { extractMentions, notifyMentions } from './services/mentionParser.js';
import { analyseImage, isAnalysisConfigured } from './services/imageAnalysis.js';

// ─── In-memory stores (replace with Prisma after migration) ────

const issues = new Map<string, Issue>();
const comments = new Map<string, Comment[]>();
const labels = new Map<string, Label>();
const issueLabels = new Map<string, Set<string>>(); // issueId → Set<labelId>

// Default actor for requests without auth context
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';

function getActorId(req: any): string {
    return req.headers['x-user-id'] as string ?? SYSTEM_ACTOR;
}

export function registerRoutes(app: FastifyInstance) {
    // ─── Issues ────────────────────────────────────────────────

    // GET / — List issues (with filtering + cursor pagination)
    app.get('/', async (req) => {
        const filter = IssueFilterSchema.safeParse(req.query);
        let items = Array.from(issues.values());

        if (filter.success) {
            const f = filter.data;
            if (f.status) items = items.filter(i => i.status === f.status);
            if (f.priority) items = items.filter(i => i.priority === f.priority);
            if (f.assignee) items = items.filter(i => i.assigneeIds.includes(f.assignee!));
            if (f.label) items = items.filter(i => {
                const lbls = issueLabels.get(i.id);
                return lbls?.has(f.label!) ?? false;
            });
            if (!f.includeArchived) items = items.filter(i => !i.archivedAt);
            if (f.q) {
                const q = f.q.toLowerCase();
                items = items.filter(i =>
                    i.title.toLowerCase().includes(q) ||
                    i.description?.toLowerCase().includes(q),
                );
            }
            if (f.dueBefore) {
                const before = new Date(f.dueBefore).getTime();
                items = items.filter(i => i.dueDate && new Date(i.dueDate).getTime() <= before);
            }
            if (f.dueAfter) {
                const after = new Date(f.dueAfter).getTime();
                items = items.filter(i => i.dueDate && new Date(i.dueDate).getTime() >= after);
            }

            // Cursor-based pagination
            if (f.cursor) {
                const cursorIdx = items.findIndex(i => i.id === f.cursor);
                if (cursorIdx >= 0) items = items.slice(cursorIdx + 1);
            }

            const total = items.length;
            const limit = f.limit;
            const page = items.slice(0, limit);

            return {
                items: page,
                total,
                nextCursor: page.length === limit && page.length > 0 ? page[page.length - 1].id : null,
            };
        }

        return { items: items.slice(0, 25), total: items.length, nextCursor: null };
    });

    // POST / — Create issue
    app.post('/', async (req, reply) => {
        const result = CreateIssueSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const actorId = getActorId(req);
        const now = new Date().toISOString();
        const item: Issue = {
            id: randomUUID(),
            ...result.data,
            assigneeIds: result.data.assigneeIds ?? [],
            labelIds: result.data.labelIds ?? [],
            dueDate: result.data.dueDate ?? null,
            archivedAt: null,
            imageAnalysisEnabled: true,
            shareWithHappyMates: result.data.shareWithHappyMates ?? false,
            createdAt: now,
            updatedAt: now,
        };
        issues.set(item.id, item);

        // Track labels
        if (item.labelIds.length > 0) {
            issueLabels.set(item.id, new Set(item.labelIds));
        }

        // Audit
        await emitEvent(item.id, actorId, 'created');

        // @Mentions in description
        if (item.description) {
            const mentions = extractMentions(item.description);
            if (mentions.length > 0) {
                await notifyMentions(mentions, item.id, actorId, 'description');
            }
        }

        return reply.status(201).send(item);
    });

    // GET /:id — Get issue by ID
    app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const item = issues.get(req.params.id);
        if (!item) return reply.status(404).send({ error: 'Not found' });
        return item;
    });

    // PUT /:id — Update issue
    app.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const existing = issues.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        const result = UpdateIssueSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const actorId = getActorId(req);

        // Track changes for audit
        if (result.data.status && result.data.status !== existing.status) {
            await emitEvent(existing.id, actorId, 'status_changed', existing.status, result.data.status);
        }
        if (result.data.priority && result.data.priority !== existing.priority) {
            await emitEvent(existing.id, actorId, 'priority_changed', existing.priority, result.data.priority);
        }
        if (result.data.dueDate !== undefined) {
            await emitEvent(existing.id, actorId, 'due_date_set', existing.dueDate ?? undefined, result.data.dueDate ?? undefined);
        }
        if (result.data.title || result.data.description !== undefined) {
            await emitEvent(existing.id, actorId, 'edited');
        }

        const updated: Issue = {
            ...existing,
            ...result.data,
            updatedAt: new Date().toISOString(),
        };
        issues.set(updated.id, updated);

        // @Mentions in updated description
        if (result.data.description) {
            const mentions = extractMentions(result.data.description);
            if (mentions.length > 0) {
                await notifyMentions(mentions, updated.id, actorId, 'description');
            }
        }

        return updated;
    });

    // DELETE /:id — Soft delete (archive)
    app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const existing = issues.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        const actorId = getActorId(req);
        existing.archivedAt = new Date().toISOString();
        existing.updatedAt = new Date().toISOString();
        issues.set(existing.id, existing);
        await emitEvent(existing.id, actorId, 'archived');
        return { success: true };
    });

    // POST /:id/restore — Restore archived issue
    app.post<{ Params: { id: string } }>('/:id/restore', async (req, reply) => {
        const existing = issues.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        const actorId = getActorId(req);
        existing.archivedAt = null;
        existing.updatedAt = new Date().toISOString();
        issues.set(existing.id, existing);
        await emitEvent(existing.id, actorId, 'restored');
        return existing;
    });

    // PUT /:id/assign — Update assignees
    app.put<{ Params: { id: string } }>('/:id/assign', async (req, reply) => {
        const existing = issues.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        const result = AssignIssueSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const actorId = getActorId(req);

        const oldAssignees = existing.assigneeIds;
        existing.assigneeIds = result.data.assigneeIds;
        existing.updatedAt = new Date().toISOString();
        issues.set(existing.id, existing);

        // Emit assign/unassign events
        const added = result.data.assigneeIds.filter(id => !oldAssignees.includes(id));
        const removed = oldAssignees.filter(id => !result.data.assigneeIds.includes(id));
        for (const uid of added) await emitEvent(existing.id, actorId, 'assigned', null, uid);
        for (const uid of removed) await emitEvent(existing.id, actorId, 'unassigned', uid, null);

        return existing;
    });

    // PUT /:id/labels — Update labels on an issue
    app.put<{ Params: { id: string } }>('/:id/labels', async (req, reply) => {
        const existing = issues.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        const { labelIds } = req.body as { labelIds: string[] };
        if (!Array.isArray(labelIds)) return reply.status(400).send({ error: 'labelIds must be an array' });
        const actorId = getActorId(req);

        const oldLabels = issueLabels.get(existing.id) ?? new Set<string>();
        const newLabels = new Set(labelIds);

        for (const lid of labelIds) {
            if (!oldLabels.has(lid)) await emitEvent(existing.id, actorId, 'label_added', null, lid);
        }
        for (const lid of oldLabels) {
            if (!newLabels.has(lid)) await emitEvent(existing.id, actorId, 'label_removed', lid, null);
        }

        issueLabels.set(existing.id, newLabels);
        existing.labelIds = labelIds;
        existing.updatedAt = new Date().toISOString();
        issues.set(existing.id, existing);

        return existing;
    });

    // ─── Comments ──────────────────────────────────────────────

    // GET /:id/comments
    app.get<{ Params: { id: string } }>('/:id/comments', async (req, reply) => {
        if (!issues.has(req.params.id)) return reply.status(404).send({ error: 'Issue not found' });
        const list = comments.get(req.params.id) ?? [];
        return { items: list, total: list.length };
    });

    // POST /:id/comments
    app.post<{ Params: { id: string } }>('/:id/comments', async (req, reply) => {
        if (!issues.has(req.params.id)) return reply.status(404).send({ error: 'Issue not found' });
        const actorId = getActorId(req);
        const body = req.body as Record<string, unknown>;
        const result = CreateCommentSchema.safeParse({
            ...body,
            issueId: req.params.id,
            authorId: body.authorId ?? actorId,
        });
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const now = new Date().toISOString();
        const comment: Comment = {
            id: crypto.randomUUID(),
            ...result.data,
            createdAt: now,
            updatedAt: now,
        };
        const existing = comments.get(req.params.id) ?? [];
        existing.push(comment);
        comments.set(req.params.id, existing);

        // Audit
        await emitEvent(req.params.id, actorId, 'commented', null, comment.id);

        // @Mentions in comment
        const mentions = extractMentions(comment.body);
        if (mentions.length > 0) {
            await notifyMentions(mentions, req.params.id, actorId, 'comment');
        }

        return reply.status(201).send(comment);
    });

    // GET /:id/history — Audit trail
    app.get<{ Params: { id: string } }>('/:id/history', async (req, reply) => {
        if (!issues.has(req.params.id)) return reply.status(404).send({ error: 'Issue not found' });
        const events = getEventsForIssue(req.params.id);
        return { items: events, total: events.length };
    });

    // ─── Labels ────────────────────────────────────────────────

    app.get('/labels', async () => {
        return { items: Array.from(labels.values()), total: labels.size };
    });

    app.post('/labels', async (req, reply) => {
        const result = CreateLabelSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const label: Label = { id: crypto.randomUUID(), ...result.data };
        labels.set(label.id, label);
        return reply.status(201).send(label);
    });

    app.put<{ Params: { id: string } }>('/labels/:id', async (req, reply) => {
        const existing = labels.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        const result = UpdateLabelSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const updated: Label = { ...existing, ...result.data };
        labels.set(updated.id, updated);
        return updated;
    });

    app.delete<{ Params: { id: string } }>('/labels/:id', async (req, reply) => {
        if (!labels.delete(req.params.id)) return reply.status(404).send({ error: 'Not found' });
        return { success: true };
    });

    // ─── Image Analysis ────────────────────────────────────────

    app.post('/analyse-image', async (req, reply) => {
        if (!isAnalysisConfigured()) {
            return reply.status(501).send({
                error: 'Image analysis not configured. Set IMAGE_ANALYSIS_ENDPOINT and IMAGE_ANALYSIS_KEY.',
                configured: false,
            });
        }

        try {
            const data = await req.file();
            if (!data) return reply.status(400).send({ error: 'No file uploaded' });

            const buffer = await data.toBuffer();
            const result = await analyseImage(buffer);

            return {
                detections: result.detections,
                width: result.width,
                height: result.height,
                redactedImageBase64: result.redactedBuffer.toString('base64'),
            };
        } catch (err) {
            console.error('[ImageAnalysis] Route error:', err);
            return reply.status(500).send({ error: 'Image analysis failed' });
        }
    });
}

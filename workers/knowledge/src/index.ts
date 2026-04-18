/**
 * Knowledge Worker — Handles knowledge management jobs.
 *
 * Job handlers:
 *   - job.knowledge.index-article    — Extract text, chunk, compute metadata
 *   - job.knowledge.validate-template — Validate template structure + sections
 *   - job.knowledge.generate-training — Generate training modules from article
 *   - job.knowledge.detect-duplicates — Find similar articles via title + content hash
 *
 * Own Prisma schema segment: `knowledge`
 */

// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import { WorkerBase } from '@surdej/worker-template';
import { createHash } from 'crypto';

// ─── Helpers ────────────────────────────────────────────────

/** Simple text chunker — splits content into overlapping chunks */
function chunkText(text: string, chunkSize = 512, overlap = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        chunks.push(words.slice(start, end).join(' '));
        start = end - overlap;
        if (start >= words.length) break;
    }

    return chunks;
}

/** Compute a content hash for duplicate detection */
function contentHash(text: string): string {
    return createHash('sha256')
        .update(text.toLowerCase().replace(/\s+/g, ' ').trim())
        .digest('hex')
        .slice(0, 16);
}

/** Simple title similarity (Jaccard on word sets) */
function titleSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

/** Extract plain text from markdown-like content */
function extractPlainText(content: string): string {
    return content
        .replace(/```[\s\S]*?```/g, '')   // Remove code blocks
        .replace(/!\[.*?\]\(.*?\)/g, '')   // Remove images
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Remove link URLs
        .replace(/#{1,6}\s/g, '')          // Remove heading markers
        .replace(/[*_~`]/g, '')            // Remove formatting
        .replace(/\n{3,}/g, '\n\n')        // Normalize whitespace
        .trim();
}

// ─── Content types for template validation ────────────────

const VALID_CONTENT_TYPES = new Set([
    'text', 'rich-text', 'image', 'table', 'checklist', 'code', 'video', 'attachment',
]);

interface TemplateSection {
    title: string;
    contentType?: string;
    required?: boolean;
    children?: TemplateSection[];
}

interface ArticlePayload {
    articleId: string;
    title?: string;
    content?: string;
    tags?: string[];
    author?: string;
}

interface TemplatePayload {
    templateId: string;
    name?: string;
    sections?: TemplateSection[];
    maxDepth?: number;
}

interface TrainingPayload {
    articleId: string;
    title?: string;
    content?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    targetDuration?: number; // minutes
}

interface DuplicatePayload {
    articleId: string;
    title?: string;
    content?: string;
    existingArticles?: Array<{ id: string; title: string; contentHash: string }>;
    threshold?: number;
}

// ─── Worker ─────────────────────────────────────────────────

class KnowledgeWorker extends WorkerBase {
    constructor() {
        super({
            type: 'knowledge',
            version: '0.2.0',
            capabilities: ['index', 'validate', 'training', 'duplicates'],
            maxConcurrency: 10,
            prismaSchema: 'knowledge',
        });

        // ─── index-article ──────────────────────────────────

        this.handle('index-article', async (job) => {
            const payload = job.payload as ArticlePayload;
            const { articleId, title, content, tags, author } = payload;

            if (!articleId) throw new Error('articleId is required');
            if (!content) {
                return { status: 'skipped', articleId, reason: 'No content to index' };
            }

            console.log(`[Knowledge] Indexing article: ${articleId} — "${title ?? 'Untitled'}"`);

            const plainText = extractPlainText(content);
            const chunks = chunkText(plainText, 512, 50);
            const hash = contentHash(plainText);
            const wordCount = plainText.split(/\s+/).length;
            const readingTimeMinutes = Math.ceil(wordCount / 200);

            // Extract headings for structure metadata
            const headings = (content.match(/^#{1,3}\s.+$/gm) ?? []).map(h => h.replace(/^#+\s/, ''));

            return {
                status: 'indexed',
                articleId,
                title: title ?? 'Untitled',
                metadata: {
                    wordCount,
                    readingTimeMinutes,
                    chunkCount: chunks.length,
                    contentHash: hash,
                    headings,
                    tags: tags ?? [],
                    author: author ?? 'unknown',
                    indexedAt: new Date().toISOString(),
                },
            };
        });

        // ─── validate-template ──────────────────────────────

        this.handle('validate-template', async (job) => {
            const payload = job.payload as TemplatePayload;
            const { templateId, name, sections, maxDepth = 3 } = payload;

            if (!templateId) throw new Error('templateId is required');

            console.log(`[Knowledge] Validating template: ${templateId} — "${name ?? 'Unnamed'}"`);

            const errors: string[] = [];
            const warnings: string[] = [];

            if (!sections || sections.length === 0) {
                errors.push('Template must have at least one section.');
            }

            // Validate section tree
            function validateSections(secs: TemplateSection[], depth: number, path: string) {
                for (let i = 0; i < secs.length; i++) {
                    const sec = secs[i];
                    const secPath = `${path}/${sec.title || `section[${i}]`}`;

                    if (!sec.title || sec.title.trim().length === 0) {
                        errors.push(`${secPath}: Section title is required.`);
                    }

                    if (sec.contentType && !VALID_CONTENT_TYPES.has(sec.contentType)) {
                        errors.push(`${secPath}: Invalid content type "${sec.contentType}". Valid: ${[...VALID_CONTENT_TYPES].join(', ')}`);
                    }

                    if (depth >= maxDepth && sec.children?.length) {
                        warnings.push(`${secPath}: Nesting exceeds max depth (${maxDepth}). Flattening recommended.`);
                    }

                    if (sec.children?.length) {
                        validateSections(sec.children, depth + 1, secPath);
                    }
                }
            }

            if (sections) {
                validateSections(sections, 1, '');
            }

            // Count required sections
            function countRequired(secs: TemplateSection[]): number {
                let count = 0;
                for (const sec of secs) {
                    if (sec.required) count++;
                    if (sec.children) count += countRequired(sec.children);
                }
                return count;
            }

            const totalSections = sections?.length ?? 0;
            const requiredCount = sections ? countRequired(sections) : 0;

            if (requiredCount === 0 && totalSections > 0) {
                warnings.push('No required sections defined. Consider marking key sections as required.');
            }

            return {
                status: errors.length === 0 ? 'valid' : 'invalid',
                templateId,
                name,
                totalSections,
                requiredSections: requiredCount,
                errors,
                warnings,
                validatedAt: new Date().toISOString(),
            };
        });

        // ─── generate-training ──────────────────────────────

        this.handle('generate-training', async (job) => {
            const payload = job.payload as TrainingPayload;
            const { articleId, title, content, difficulty = 'beginner', targetDuration = 30 } = payload;

            if (!articleId) throw new Error('articleId is required');
            if (!content) {
                return { status: 'skipped', articleId, reason: 'No content for training generation' };
            }

            console.log(`[Knowledge] Generating training for: ${articleId} — "${title ?? 'Untitled'}"`);

            const plainText = extractPlainText(content);
            const headings = (content.match(/^#{1,3}\s.+$/gm) ?? []).map(h => h.replace(/^#+\s/, ''));

            // Build training modules from headings
            const minutesPerModule = headings.length > 0
                ? Math.max(5, Math.floor(targetDuration / headings.length))
                : targetDuration;

            type TrainingModule = {
                order: number;
                title: string;
                durationMinutes: number;
                type: 'lesson' | 'assessment';
                elements: { type: string; label: string }[];
            };

            const modules: TrainingModule[] = headings.length > 0
                ? headings.map((heading, i) => ({
                    order: i + 1,
                    title: heading,
                    durationMinutes: minutesPerModule,
                    type: 'lesson' as const,
                    elements: [
                        { type: 'content', label: `Read: ${heading}` },
                        { type: 'quiz', label: `Check understanding: ${heading}` },
                    ],
                }))
                : [{
                    order: 1,
                    title: title ?? 'Main Content',
                    durationMinutes: targetDuration,
                    type: 'lesson' as const,
                    elements: [
                        { type: 'content', label: 'Read the article' },
                        { type: 'checklist', label: 'Completion checklist' },
                    ],
                }];

            // Add summary module
            modules.push({
                order: modules.length + 1,
                title: 'Summary & Assessment',
                durationMinutes: Math.max(5, Math.floor(targetDuration * 0.2)),
                type: 'assessment' as const,
                elements: [
                    { type: 'quiz', label: 'Final assessment' },
                    { type: 'checklist', label: 'Skills checklist' },
                ],
            });

            const totalDuration = modules.reduce((sum, m) => sum + m.durationMinutes, 0);

            return {
                status: 'generated',
                articleId,
                training: {
                    title: `Training: ${title ?? 'Untitled'}`,
                    difficulty,
                    totalDurationMinutes: totalDuration,
                    moduleCount: modules.length,
                    modules,
                    generatedAt: new Date().toISOString(),
                },
            };
        });

        // ─── detect-duplicates ──────────────────────────────

        this.handle('detect-duplicates', async (job) => {
            const payload = job.payload as DuplicatePayload;
            const { articleId, title, content, existingArticles = [], threshold = 0.5 } = payload;

            if (!articleId) throw new Error('articleId is required');

            console.log(`[Knowledge] Detecting duplicates for: ${articleId} — "${title ?? 'Untitled'}"`);

            const duplicates: Array<{
                id: string;
                title: string;
                similarity: number;
                matchType: 'title' | 'content' | 'both';
            }> = [];

            const hash = content ? contentHash(content) : null;

            for (const existing of existingArticles) {
                if (existing.id === articleId) continue;

                let matchType: 'title' | 'content' | 'both' | null = null;
                let similarity = 0;

                // Title similarity check
                if (title && existing.title) {
                    const titleSim = titleSimilarity(title, existing.title);
                    if (titleSim >= threshold) {
                        matchType = 'title';
                        similarity = titleSim;
                    }
                }

                // Content hash check (exact content duplicate)
                if (hash && existing.contentHash === hash) {
                    matchType = matchType === 'title' ? 'both' : 'content';
                    similarity = matchType === 'both' ? 1.0 : 0.95;
                }

                if (matchType) {
                    duplicates.push({
                        id: existing.id,
                        title: existing.title,
                        similarity: Math.round(similarity * 100) / 100,
                        matchType,
                    });
                }
            }

            // Sort by similarity descending
            duplicates.sort((a, b) => b.similarity - a.similarity);

            return {
                status: 'checked',
                articleId,
                duplicates,
                totalCompared: existingArticles.length,
                checkedAt: new Date().toISOString(),
            };
        });
    }
}

// Start
const worker = new KnowledgeWorker();
worker.start().catch((err) => {
    console.error('Knowledge worker failed to start:', err);
    process.exit(1);
});


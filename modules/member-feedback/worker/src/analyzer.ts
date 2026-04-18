/**
 * AI Ticket Analyzer
 *
 * Subscribes to NATS ticket events and triggers Python AI analysis.
 * On every ticket creation or status transition, it:
 *   1. Sends the ticket context to the Python analyzer
 *   2. Receives structured analysis (sentiment, routing, next-best-answer)
 *   3. Updates the ticket's aiAnalysis field
 */

import type { NatsConnection, Codec } from 'nats';
import { NATS_SUBJECTS, type AiAnalysis } from '@surdej/module-member-feedback-shared';
import { prisma } from './db.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PYTHON_SCRIPT = join(__dirname, '..', 'python', 'analyze.py');

/**
 * Run the Python analyzer on a ticket's context.
 * Falls back to a heuristic analysis if Python is unavailable.
 */
async function runPythonAnalysis(ticketContext: object): Promise<AiAnalysis> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Analyzer] Python timeout — using heuristic fallback');
            resolve(heuristicAnalysis(ticketContext as any));
        }, 30_000);

        try {
            const proc = spawn('python3', [PYTHON_SCRIPT], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    TICKET_CONTEXT: JSON.stringify(ticketContext),
                },
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
            proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0 && stdout.trim()) {
                    try {
                        const result = JSON.parse(stdout.trim());
                        resolve(result as AiAnalysis);
                    } catch (e) {
                        console.error('[Analyzer] Failed to parse Python output:', stdout);
                        resolve(heuristicAnalysis(ticketContext as any));
                    }
                } else {
                    if (stderr) console.error('[Analyzer] Python stderr:', stderr);
                    resolve(heuristicAnalysis(ticketContext as any));
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                console.warn('[Analyzer] Python not available:', err.message);
                resolve(heuristicAnalysis(ticketContext as any));
            });

            proc.stdin.write(JSON.stringify(ticketContext));
            proc.stdin.end();
        } catch (err) {
            clearTimeout(timeout);
            console.warn('[Analyzer] Failed to spawn Python:', err);
            resolve(heuristicAnalysis(ticketContext as any));
        }
    });
}

/**
 * Heuristic fallback when Python/AI is unavailable.
 */
function heuristicAnalysis(ctx: { title?: string; description?: string; category?: string; status?: string }): AiAnalysis {
    const text = `${ctx.title ?? ''} ${ctx.description ?? ''}`.toLowerCase();

    const urgentWords = ['urgent', 'broken', 'critical', 'down', 'error', 'crash', 'haste', 'asap', 'akut', 'fejl'];
    const negativeWords = ['frustrated', 'angry', 'unacceptable', 'terrible', 'worst', 'vred', 'frustreret', 'uacceptabel'];
    const bugWords = ['bug', 'error', 'crash', 'broken', 'not working', 'fejl', 'virker ikke'];
    const featureWords = ['feature', 'request', 'would like', 'suggestion', 'forslag', 'ønske'];

    const isUrgent = urgentWords.some(w => text.includes(w));
    const isNegative = negativeWords.some(w => text.includes(w));
    const isBug = bugWords.some(w => text.includes(w));
    const isFeature = featureWords.some(w => text.includes(w));

    return {
        sentiment: isNegative ? 'frustrated' : 'neutral',
        urgency: isUrgent ? 'high' : 'medium',
        suggestedCategory: isBug ? 'bug' : isFeature ? 'feature_request' : (ctx.category as any) ?? 'general',
        suggestedPriority: isUrgent ? 'high' : 'medium',
        suggestedRoute: isBug ? 'Engineering' : isFeature ? 'Product' : 'Support',
        nextBestAnswer: `Tak for din henvendelse. Vi har modtaget din ${isBug ? 'fejlrapport' : isFeature ? 'forespørgsel' : 'henvendelse'} og vil besvare den hurtigst muligt.`,
        summary: ctx.title ?? 'No title provided',
        keywords: text.split(/\s+/).filter(w => w.length > 4).slice(0, 5),
        confidence: 0.5,
    };
}

/**
 * Register NATS subscriptions for ticket analysis.
 */
export function registerAnalyzer(nc: NatsConnection, codec: Codec<unknown>) {
    // Analyze on ticket creation
    const createdSub = nc.subscribe(NATS_SUBJECTS.ticketCreated);
    (async () => {
        for await (const msg of createdSub) {
            try {
                const data = codec.decode(msg.data) as { ticketId: string };
                await analyzeAndUpdate(data.ticketId);
            } catch (err) {
                console.error('[Analyzer] Error processing ticketCreated:', err);
            }
        }
    })();

    // Re-analyze on transition
    const transitionedSub = nc.subscribe(NATS_SUBJECTS.ticketTransitioned);
    (async () => {
        for await (const msg of transitionedSub) {
            try {
                const data = codec.decode(msg.data) as { ticketId: string };
                await analyzeAndUpdate(data.ticketId);
            } catch (err) {
                console.error('[Analyzer] Error processing ticketTransitioned:', err);
            }
        }
    })();

    console.log('[Analyzer] Subscribed to ticket events');
}

async function analyzeAndUpdate(ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
            comments: { orderBy: { createdAt: 'asc' } },
            transitions: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
    });

    if (!ticket) return;

    console.log(`[Analyzer] Analyzing ticket ${ticket.ticketNumber}...`);

    const analysis = await runPythonAnalysis({
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        tags: ticket.tags,
        comments: ticket.comments.map(c => ({
            content: c.content,
            isInternal: c.isInternal,
            createdAt: c.createdAt.toISOString(),
        })),
        transitions: ticket.transitions.map(t => ({
            from: t.fromStatus,
            to: t.toStatus,
            reason: t.reason,
            createdAt: t.createdAt.toISOString(),
        })),
    });

    await prisma.ticket.update({
        where: { id: ticketId },
        data: { aiAnalysis: analysis as any },
    });

    console.log(`[Analyzer] Updated ticket ${ticket.ticketNumber} with AI analysis (confidence: ${analysis.confidence})`);
}

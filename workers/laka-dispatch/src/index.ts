/**
 * LAKA Dispatch Worker — Handles email classification and queue routing jobs.
 *
 * Job handlers:
 *   - job.nexi.ingest      — Parse incoming email, extract metadata
 *   - job.nexi.classify    — AI classification: region, category, urgency
 *   - job.nexi.route       — Route to target queue based on routing rules
 *   - job.nexi.notify      — Send agent notification + SLA timer
 *
 * Own Prisma schema segment: `laka_dispatch`
 */

// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import { WorkerBase } from '@surdej/worker-template';

// ─── Types ──────────────────────────────────────────────────

const CATEGORIES = [
    'Card Issues',
    'Payment Decline',
    'Account & Billing',
    'Fraud & Disputes',
    'Terminal & POS',
    'VIP Support',
    'General Inquiry',
] as const;

type Category = typeof CATEGORIES[number];
type Region = 'FI' | 'SE';
type Urgency = 'low' | 'medium' | 'high' | 'critical';

interface RoutingRule {
    region: Region;
    category: Category;
    targetQueue: string;
    slaMinutes: number;
}

interface VipCustomer {
    email: string;
    domain?: string;
    name: string;
    tier: 'gold' | 'platinum';
}

// ─── Routing Rules ──────────────────────────────────────────

const ROUTING_RULES: RoutingRule[] = [
    { region: 'FI', category: 'Card Issues', targetQueue: 'FI-Cards', slaMinutes: 15 },
    { region: 'FI', category: 'Payment Decline', targetQueue: 'FI-Cards', slaMinutes: 20 },
    { region: 'FI', category: 'Account & Billing', targetQueue: 'FI-General', slaMinutes: 30 },
    { region: 'FI', category: 'Fraud & Disputes', targetQueue: 'FI-Fraud', slaMinutes: 5 },
    { region: 'FI', category: 'Terminal & POS', targetQueue: 'FI-General', slaMinutes: 60 },
    { region: 'FI', category: 'VIP Support', targetQueue: 'FI-VIP', slaMinutes: 3 },
    { region: 'FI', category: 'General Inquiry', targetQueue: 'FI-General', slaMinutes: 30 },
    { region: 'SE', category: 'Card Issues', targetQueue: 'SE-Payments', slaMinutes: 15 },
    { region: 'SE', category: 'Payment Decline', targetQueue: 'SE-Payments', slaMinutes: 20 },
    { region: 'SE', category: 'Account & Billing', targetQueue: 'SE-Account', slaMinutes: 30 },
    { region: 'SE', category: 'Fraud & Disputes', targetQueue: 'SE-Payments', slaMinutes: 5 },
    { region: 'SE', category: 'Terminal & POS', targetQueue: 'SE-Terminal', slaMinutes: 60 },
    { region: 'SE', category: 'VIP Support', targetQueue: 'SE-VIP', slaMinutes: 3 },
    { region: 'SE', category: 'General Inquiry', targetQueue: 'SE-Account', slaMinutes: 30 },
];

const VIP_CUSTOMERS: VipCustomer[] = [
    { email: 'ceo@nordicbank.fi', name: 'Nordic Bank', tier: 'platinum' },
    { email: '', domain: 'bigcorp.se', name: 'BigCorp AB', tier: 'gold' },
    { email: '', domain: 'retailchain.se', name: 'RetailChain', tier: 'gold' },
];

// ─── Helpers ────────────────────────────────────────────────

/** Detect region from email language or sender domain */
function detectRegion(email: string, subject: string, body: string): Region {
    const senderDomain = email.split('@')[1] ?? '';

    // Domain-based detection
    if (senderDomain.endsWith('.fi')) return 'FI';
    if (senderDomain.endsWith('.se')) return 'SE';

    // Language heuristics
    const text = `${subject} ${body}`.toLowerCase();
    const fiMarkers = ['kortti', 'lasku', 'maksu', 'tili', 'asiakkaan', 'hyvää', 'kiitos', 'pääte'];
    const seMarkers = ['kort', 'faktura', 'betalning', 'konto', 'kundens', 'tack', 'terminal'];

    const fiScore = fiMarkers.filter((m) => text.includes(m)).length;
    const seScore = seMarkers.filter((m) => text.includes(m)).length;

    return fiScore >= seScore ? 'FI' : 'SE';
}

/** Check if sender is a VIP customer */
function checkVip(senderEmail: string): VipCustomer | null {
    const domain = senderEmail.split('@')[1] ?? '';

    for (const vip of VIP_CUSTOMERS) {
        if (vip.email && vip.email.toLowerCase() === senderEmail.toLowerCase()) return vip;
        if (vip.domain && domain.toLowerCase() === vip.domain.toLowerCase()) return vip;
    }
    return null;
}

/** Keyword-based category classification (simulated AI) */
function classifyCategory(subject: string, body: string): { category: Category; confidence: number } {
    const text = `${subject} ${body}`.toLowerCase();

    const categoryKeywords: Record<Category, string[]> = {
        'Card Issues': ['card', 'kortti', 'kort', 'pin', 'activate', 'replace', 'delivery', 'limit', 'block'],
        'Payment Decline': ['decline', 'rejected', 'failed', 'payment', 'maksu', 'betalning', 'settlement', 'refund'],
        'Account & Billing': ['account', 'invoice', 'billing', 'fee', 'lasku', 'faktura', 'contract', 'subscription'],
        'Fraud & Disputes': ['fraud', 'stolen', 'suspicious', 'chargeback', 'petos', 'bedrägeri', 'dispute', 'unauthorized'],
        'Terminal & POS': ['terminal', 'pos', 'pääte', 'error code', 'installation', 'setup', 'network'],
        'VIP Support': ['vip', 'platinum', 'priority', 'dedicated'],
        'General Inquiry': ['question', 'info', 'help', 'general', 'onboarding'],
    };

    let bestCategory: Category = 'General Inquiry';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords) as [Category, string[]][]) {
        const score = keywords.filter((kw) => text.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    const confidence = Math.min(0.5 + bestScore * 0.15, 0.98);
    return { category: bestCategory, confidence };
}

/** Assess urgency from text analysis */
function assessUrgency(subject: string, body: string, category: Category, isVip: boolean): Urgency {
    if (isVip) return 'critical';
    if (category === 'Fraud & Disputes') return 'critical';

    const text = `${subject} ${body}`.toLowerCase();
    const urgentWords = ['urgent', 'kiireellinen', 'brådskande', 'immediately', 'asap', 'critical', 'emergency', 'blocked', 'stolen'];
    const urgentCount = urgentWords.filter((w) => text.includes(w)).length;

    if (urgentCount >= 2) return 'critical';
    if (urgentCount >= 1) return 'high';
    if (category === 'Card Issues' || category === 'Payment Decline') return 'medium';
    return 'low';
}

// ─── Job Payload Types ──────────────────────────────────────

interface IngestPayload {
    id: string;
    subject: string;
    sender: string;
    body: string;
    receivedAt: string;
}

interface ClassifyPayload {
    id: string;
    subject: string;
    sender: string;
    body: string;
    region: Region;
}

interface RoutePayload {
    id: string;
    region: Region;
    category: Category;
    urgency: Urgency;
    isVip: boolean;
    vipCustomer?: VipCustomer | null;
}

interface NotifyPayload {
    id: string;
    targetQueue: string;
    subject: string;
    urgency: Urgency;
    slaMinutes: number;
}

// ─── Worker ─────────────────────────────────────────────────

const worker = new WorkerBase({
    type: 'laka-dispatch',
    version: '1.0.0',
    capabilities: ['ingest', 'classify', 'route', 'notify'],
    maxConcurrency: 8,
    prismaSchema: 'laka_dispatch',
});

// ── job.nexi.ingest ─────────────────────────────────────────
worker.handle<IngestPayload>('job.nexi.ingest', async (job) => {
    const { id, subject, sender, body, receivedAt } = job.payload;
    console.log(`[ingest] Processing email ${id}: "${subject}" from ${sender}`);

    // Step 1: Detect region
    const region = detectRegion(sender, subject, body);
    console.log(`[ingest] Detected region: ${region}`);

    // TODO: Persist to laka_dispatch.dispatch_item table

    // Forward to classification
    // TODO: Publish NATS job: job.nexi.classify
    return {
        id,
        region,
        forwarded: 'classify',
    };
});

// ── job.nexi.classify ───────────────────────────────────────
worker.handle<ClassifyPayload>('job.nexi.classify', async (job) => {
    const { id, subject, sender, body, region } = job.payload;
    console.log(`[classify] Classifying email ${id} for region ${region}`);

    // Step 2: Check VIP status
    const vipCustomer = checkVip(sender);
    const isVip = vipCustomer !== null;
    if (isVip) {
        console.log(`[classify] VIP customer detected: ${vipCustomer!.name} (${vipCustomer!.tier})`);
    }

    // Step 3: AI classification (simulated)
    // TODO: Use GPT-4o for real classification
    const { category, confidence } = classifyCategory(subject, body);
    const effectiveCategory = isVip ? 'VIP Support' : category;

    // Step 4: Urgency assessment
    const urgency = assessUrgency(subject, body, effectiveCategory, isVip);

    console.log(`[classify] Result: category=${effectiveCategory}, urgency=${urgency}, confidence=${confidence.toFixed(2)}`);

    // TODO: Update dispatch_item in database with classification results

    return {
        id,
        region,
        category: effectiveCategory,
        urgency,
        isVip,
        vipCustomer,
        confidence,
    };
});

// ── job.nexi.route ──────────────────────────────────────────
worker.handle<RoutePayload>('job.nexi.route', async (job) => {
    const { id, region, category, urgency, isVip, vipCustomer } = job.payload;
    console.log(`[route] Routing email ${id}: ${region}/${category}/${urgency}`);

    // Step 5: Find matching routing rule
    const rule = ROUTING_RULES.find(
        (r) => r.region === region && r.category === category
    );

    if (!rule) {
        // Fallback to general queue for the region
        const fallbackQueue = `${region}-General`;
        console.log(`[route] No exact rule found, using fallback: ${fallbackQueue}`);
        return {
            id,
            targetQueue: fallbackQueue,
            slaMinutes: 30,
            routingMethod: 'fallback',
        };
    }

    console.log(`[route] Matched rule → ${rule.targetQueue} (SLA: ${rule.slaMinutes}min)`);

    // TODO: Check queue capacity, overflow if needed
    // TODO: Update dispatch_item with queue assignment

    return {
        id,
        targetQueue: rule.targetQueue,
        slaMinutes: rule.slaMinutes,
        routingMethod: isVip ? 'vip-priority' : 'rule-match',
    };
});

// ── job.nexi.notify ─────────────────────────────────────────
worker.handle<NotifyPayload>('job.nexi.notify', async (job) => {
    const { id, targetQueue, subject, urgency, slaMinutes } = job.payload;
    console.log(`[notify] Notifying queue ${targetQueue} for email ${id}`);

    // TODO: Send real notification (webhook, email, Slack, etc.)
    // For now, simulate notification
    const notification = {
        type: urgency === 'critical' ? 'push' : 'queue',
        targetQueue,
        subject: `New ${urgency} item: ${subject}`,
        slaDeadline: new Date(Date.now() + slaMinutes * 60_000).toISOString(),
    };

    console.log(`[notify] Notification sent: ${notification.type} → ${targetQueue}`);

    return {
        id,
        notified: true,
        notificationType: notification.type,
        slaDeadline: notification.slaDeadline,
    };
});

// ─── Start ──────────────────────────────────────────────────

worker.start().catch((err: unknown) => {
    console.error('Failed to start laka-dispatch worker:', err);
    process.exit(1);
});

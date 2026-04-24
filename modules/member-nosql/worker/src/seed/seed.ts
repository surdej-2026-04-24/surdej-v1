/**
 * NoSQL Store — Seed Script
 *
 * Populates the database with sample collections and documents:
 *
 *  customers/
 *    └── contacts/        ← customer contact records
 *  competitors/
 *    └── contacts/        ← competitor contact records
 *  web-sources/
 *    └── scraped-data/    ← scraped web content
 *
 * Run with:
 *   npx tsx src/seed/seed.ts
 */

import { PrismaClient, Prisma } from '../../node_modules/.prisma/member-nosql-client/index.js';

const prisma = new PrismaClient();
const TENANT_ID = 'default';

// ─── Helpers ──────────────────────────────────────────────────

async function upsertCollection(opts: {
    tenantId: string;
    name: string;
    slug: string;
    description?: string;
    parentId?: string | null;
}) {
    const existing = await prisma.nosqlCollection.findFirst({
        where: { tenantId: opts.tenantId, slug: opts.slug, parentId: opts.parentId ?? null },
    });
    if (existing) {
        console.log(`  ↩  Collection already exists: ${opts.name} (${existing.id})`);
        return existing;
    }
    const col = await prisma.nosqlCollection.create({
        data: {
            tenantId: opts.tenantId,
            name: opts.name,
            slug: opts.slug,
            description: opts.description ?? null,
            parentId: opts.parentId ?? null,
            createdBy: 'seed',
            updatedBy: 'seed',
        },
    });
    console.log(`  ✔  Created collection: ${opts.name} (${col.id})`);
    return col;
}

async function insertDocuments(collectionId: string, docs: Record<string, unknown>[]) {
    for (const data of docs) {
        await prisma.nosqlDocument.create({
            data: {
                tenantId: TENANT_ID,
                collectionId,
                data: data as unknown as Prisma.InputJsonValue,
                version: 1,
                createdBy: 'seed',
                updatedBy: 'seed',
            },
        });
    }
    console.log(`  ✔  Inserted ${docs.length} document(s) into collection ${collectionId}`);
}

// ─── Seed Data ─────────────────────────────────────────────────

async function seedCustomers() {
    console.log('\n📦 Seeding: Customers');

    const customers = await upsertCollection({
        tenantId: TENANT_ID,
        name: 'Customers',
        slug: 'customers',
        description: 'Top-level collection of customer organisations.',
    });

    // Customer organisations
    const customerDocs = [
        {
            companyName: 'Acme Corporation',
            industry: 'Manufacturing',
            country: 'Denmark',
            annualRevenue: 12_500_000,
            tier: 'enterprise',
            status: 'active',
            tags: ['key-account', 'nordic'],
            contractStart: '2022-01-15',
            contractRenewal: '2025-01-15',
            notes: 'Primary contact is the procurement team. Prefers email communication.',
        },
        {
            companyName: 'Nordic Retail Group',
            industry: 'Retail',
            country: 'Sweden',
            annualRevenue: 4_800_000,
            tier: 'mid-market',
            status: 'active',
            tags: ['nordic', 'e-commerce'],
            contractStart: '2023-03-01',
            contractRenewal: '2025-03-01',
            notes: 'Expanding into Finland in Q3. Follow up on upsell opportunity.',
        },
        {
            companyName: 'GreenTech Solutions',
            industry: 'CleanTech',
            country: 'Norway',
            annualRevenue: 2_100_000,
            tier: 'smb',
            status: 'trial',
            tags: ['cleantech', 'startup'],
            trialEnd: '2025-07-31',
            notes: 'Fast-growing startup. Decision maker is CTO.',
        },
    ];
    await insertDocuments(customers.id, customerDocs);

    // Customer contacts sub-collection
    const contacts = await upsertCollection({
        tenantId: TENANT_ID,
        name: 'Customer Contacts',
        slug: 'contacts',
        description: 'Individual contact persons at customer organisations.',
        parentId: customers.id,
    });

    const contactDocs = [
        {
            firstName: 'Mette',
            lastName: 'Hansen',
            email: 'mette.hansen@acmecorp.dk',
            phone: '+45 23 45 67 89',
            company: 'Acme Corporation',
            role: 'Procurement Manager',
            linkedIn: 'https://linkedin.com/in/mette-hansen',
            preferredContact: 'email',
            lastContactDate: '2025-03-10',
            notes: 'Decision maker for renewal. Prefers detailed proposals.',
        },
        {
            firstName: 'Lars',
            lastName: 'Eriksson',
            email: 'lars.eriksson@nordicretail.se',
            phone: '+46 70 123 45 67',
            company: 'Nordic Retail Group',
            role: 'Head of Digital',
            linkedIn: 'https://linkedin.com/in/lars-eriksson',
            preferredContact: 'phone',
            lastContactDate: '2025-04-01',
            notes: 'Interested in analytics add-on. Schedule demo.',
        },
        {
            firstName: 'Ingrid',
            lastName: 'Solberg',
            email: 'ingrid@greentech.no',
            phone: '+47 92 345 678',
            company: 'GreenTech Solutions',
            role: 'CTO',
            linkedIn: 'https://linkedin.com/in/ingrid-solberg',
            preferredContact: 'email',
            lastContactDate: '2025-04-03',
            notes: 'Technical evaluator. Send API docs.',
        },
        {
            firstName: 'Thomas',
            lastName: 'Nielsen',
            email: 'thomas.nielsen@acmecorp.dk',
            phone: '+45 31 23 45 67',
            company: 'Acme Corporation',
            role: 'IT Director',
            linkedIn: 'https://linkedin.com/in/thomas-nielsen-acme',
            preferredContact: 'email',
            lastContactDate: '2025-02-20',
            notes: 'Secondary contact. Involved in technical integration discussions.',
        },
    ];
    await insertDocuments(contacts.id, contactDocs);
}

async function seedCompetitors() {
    console.log('\n📦 Seeding: Competitors');

    const competitors = await upsertCollection({
        tenantId: TENANT_ID,
        name: 'Competitors',
        slug: 'competitors',
        description: 'Competitive landscape — tracked competitor organisations.',
    });

    const competitorDocs = [
        {
            companyName: 'DataPulse AB',
            headquarters: 'Stockholm, Sweden',
            founded: 2018,
            employees: 85,
            funding: 'Series A ($8M)',
            primaryProduct: 'Data analytics SaaS',
            pricingModel: 'per-seat',
            strengths: ['strong UX', 'integrations', 'Nordic market presence'],
            weaknesses: ['limited AI features', 'no mobile app'],
            marketShare: 0.12,
            websiteUrl: 'https://datapulse.se',
            lastReviewed: '2025-03-15',
        },
        {
            companyName: 'FlowMetrics GmbH',
            headquarters: 'Berlin, Germany',
            founded: 2016,
            employees: 210,
            funding: 'Series B (€25M)',
            primaryProduct: 'Business intelligence platform',
            pricingModel: 'tiered',
            strengths: ['enterprise features', 'scalability', 'DACH market leader'],
            weaknesses: ['expensive', 'complex onboarding', 'poor customer support'],
            marketShare: 0.21,
            websiteUrl: 'https://flowmetrics.de',
            lastReviewed: '2025-02-28',
        },
        {
            companyName: 'Insightful.io',
            headquarters: 'London, UK',
            founded: 2020,
            employees: 40,
            funding: 'Seed ($2.5M)',
            primaryProduct: 'AI-powered reporting',
            pricingModel: 'usage-based',
            strengths: ['AI-first', 'modern API', 'competitive pricing'],
            weaknesses: ['early stage', 'limited integrations', 'small team'],
            marketShare: 0.04,
            websiteUrl: 'https://insightful.io',
            lastReviewed: '2025-04-01',
        },
    ];
    await insertDocuments(competitors.id, competitorDocs);

    // Competitor contacts sub-collection
    const contacts = await upsertCollection({
        tenantId: TENANT_ID,
        name: 'Competitor Contacts',
        slug: 'contacts',
        description: 'Known contacts at competitor organisations (from public sources, events, etc.).',
        parentId: competitors.id,
    });

    const contactDocs = [
        {
            firstName: 'Erik',
            lastName: 'Lindgren',
            email: 'erik.lindgren@datapulse.se',
            company: 'DataPulse AB',
            role: 'VP Sales',
            linkedIn: 'https://linkedin.com/in/erik-lindgren-datapulse',
            source: 'LinkedIn',
            metAt: 'SaaS Nordic 2024',
            notes: 'Active on LinkedIn. Targeting the same customer segment.',
        },
        {
            firstName: 'Julia',
            lastName: 'Bauer',
            email: 'j.bauer@flowmetrics.de',
            company: 'FlowMetrics GmbH',
            role: 'Chief Product Officer',
            linkedIn: 'https://linkedin.com/in/julia-bauer-flow',
            source: 'Conference',
            metAt: 'Data Summit Berlin 2024',
            notes: 'Announced AI roadmap for Q2 2025.',
        },
        {
            firstName: 'Priya',
            lastName: 'Shah',
            email: 'priya@insightful.io',
            company: 'Insightful.io',
            role: 'CEO & Co-founder',
            linkedIn: 'https://linkedin.com/in/priya-shah-insightful',
            source: 'Public blog',
            notes: 'Published pricing strategy post. Aggressive land-and-expand.',
        },
    ];
    await insertDocuments(contacts.id, contactDocs);
}

async function seedWebSources() {
    console.log('\n📦 Seeding: Web Sources');

    const webSources = await upsertCollection({
        tenantId: TENANT_ID,
        name: 'Web Sources',
        slug: 'web-sources',
        description: 'Tracked web sources for monitoring and intelligence gathering.',
    });

    const sourceDocs = [
        {
            name: 'TechCrunch Nordic',
            url: 'https://techcrunch.com/tag/nordic',
            category: 'news',
            language: 'en',
            crawlFrequency: 'daily',
            lastCrawled: '2025-04-05T06:00:00Z',
            isActive: true,
            tags: ['news', 'tech', 'nordic'],
        },
        {
            name: 'DataPulse Blog',
            url: 'https://datapulse.se/blog',
            category: 'competitor-blog',
            language: 'sv',
            crawlFrequency: 'weekly',
            lastCrawled: '2025-04-01T08:00:00Z',
            isActive: true,
            tags: ['competitor', 'datapulse'],
        },
        {
            name: 'LinkedIn Company: FlowMetrics GmbH',
            url: 'https://linkedin.com/company/flowmetrics',
            category: 'social',
            language: 'de',
            crawlFrequency: 'weekly',
            lastCrawled: '2025-03-30T10:00:00Z',
            isActive: true,
            tags: ['competitor', 'social', 'flowmetrics'],
        },
        {
            name: 'EU Data Regulation Updates',
            url: 'https://digital-strategy.ec.europa.eu/en/policies/data-act',
            category: 'regulatory',
            language: 'en',
            crawlFrequency: 'monthly',
            lastCrawled: '2025-04-01T00:00:00Z',
            isActive: true,
            tags: ['regulatory', 'eu', 'data-act'],
        },
    ];
    await insertDocuments(webSources.id, sourceDocs);

    // Scraped data sub-collection
    const scrapedData = await upsertCollection({
        tenantId: TENANT_ID,
        name: 'Scraped Data',
        slug: 'scraped-data',
        description: 'Raw and processed content scraped from tracked web sources.',
        parentId: webSources.id,
    });

    const scrapedDocs = [
        {
            sourceUrl: 'https://techcrunch.com/2025/04/04/nordic-saas-funding',
            sourceCategory: 'news',
            title: 'Nordic SaaS Startups Raise Record €180M in Q1 2025',
            summary: 'Nordic-based SaaS companies closed a record quarter with €180M in combined funding, led by B2B analytics and AI platforms.',
            scrapedAt: '2025-04-05T06:12:34Z',
            language: 'en',
            sentiment: 'positive',
            keywords: ['SaaS', 'Nordic', 'funding', 'AI', 'analytics'],
            relevanceScore: 0.87,
            rawContent: 'Nordic SaaS startups have raised a record €180 million in the first quarter of 2025...',
        },
        {
            sourceUrl: 'https://datapulse.se/blog/product-update-q1-2025',
            sourceCategory: 'competitor-blog',
            title: 'DataPulse Q1 2025 Product Update',
            summary: 'DataPulse announces native AI assistant, new dashboard builder, and expanded API for third-party integrations.',
            scrapedAt: '2025-04-01T08:45:00Z',
            language: 'sv',
            sentiment: 'neutral',
            keywords: ['product update', 'AI', 'dashboard', 'API', 'integrations'],
            relevanceScore: 0.94,
            rawContent: 'Vi är glada att tillkännage vår Q1 2025-produktuppdatering...',
        },
        {
            sourceUrl: 'https://linkedin.com/company/flowmetrics/posts',
            sourceCategory: 'social',
            title: 'FlowMetrics Announces SOC 2 Type II Certification',
            summary: 'FlowMetrics has achieved SOC 2 Type II compliance, strengthening its enterprise sales pitch.',
            scrapedAt: '2025-03-30T10:20:00Z',
            language: 'de',
            sentiment: 'positive',
            keywords: ['SOC2', 'compliance', 'enterprise', 'security'],
            relevanceScore: 0.78,
            rawContent: 'FlowMetrics freut sich, die SOC 2 Typ II-Zertifizierung bekannt zu geben...',
        },
        {
            sourceUrl: 'https://digital-strategy.ec.europa.eu/en/policies/data-act',
            sourceCategory: 'regulatory',
            title: 'EU Data Act — Implementation Timeline Update April 2025',
            summary: 'The EU Data Act enforcement phase begins September 2025. Key obligations for SaaS providers include data portability APIs.',
            scrapedAt: '2025-04-01T00:30:00Z',
            language: 'en',
            sentiment: 'neutral',
            keywords: ['EU Data Act', 'compliance', 'data portability', 'SaaS', 'regulation'],
            relevanceScore: 0.91,
            rawContent: 'The European Data Act enters its enforcement phase on 12 September 2025...',
        },
        {
            sourceUrl: 'https://techcrunch.com/2025/04/02/insightful-io-series-a',
            sourceCategory: 'news',
            title: 'Insightful.io Closes $8M Series A to Accelerate AI Reporting',
            summary: "Competitor Insightful.io raises $8M Series A, plans to double headcount and expand to DACH and Nordic markets in 2025.",
            scrapedAt: '2025-04-05T06:15:00Z',
            language: 'en',
            sentiment: 'neutral',
            keywords: ['funding', 'Series A', 'AI', 'reporting', 'expansion', 'Nordic'],
            relevanceScore: 0.96,
            rawContent: 'Insightful.io, the AI-powered reporting startup, has closed an $8M Series A...',
        },
    ];
    await insertDocuments(scrapedData.id, scrapedDocs);
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
    console.log('🌱 Starting NoSQL store seed...');

    await seedCustomers();
    await seedCompetitors();
    await seedWebSources();

    console.log('\n✅ Seed complete.\n');
}

main()
    .catch((err) => {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

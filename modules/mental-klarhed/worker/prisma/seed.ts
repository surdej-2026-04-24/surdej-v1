/**
 * Seed: mental-klarhed — demo reset
 *
 * Wipes all existing data and inserts 5 demo clients covering
 * every programme status and session state combination so that
 * all UI features are visible in a single page load.
 *
 * Run inside the container:
 *   npx tsx prisma/seed.ts
 */

import { PrismaClient } from '../node_modules/.prisma/mental-klarhed-client/index.js';

const prisma = new PrismaClient();

// ── Helpers ─────────────────────────────────────────────────────

function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function daysFromNow(n: number) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
    console.log('🗑️  Clearing existing demo data…');

    // Delete in dependency order
    await prisma.preSessionMaterial.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.magicLink.deleteMany();
    await prisma.session.deleteMany();
    await prisma.programme.deleteMany();
    await prisma.client.deleteMany();

    console.log('🌱 Inserting fresh demo data…');

    // ────────────────────────────────────────────────────────────
    // 1. Sara Hansen — COMPLETED, fuldt forløb med alle 5 tests
    //    → viser radar-graf med tydelig fremgang
    // ────────────────────────────────────────────────────────────
    const sara = await prisma.client.create({
        data: { email: 'sara.hansen@example.dk', name: 'Sara Hansen', locale: 'da', consentAt: daysAgo(160) },
    });

    const saraProg = await prisma.programme.create({
        data: {
            clientId: sara.id,
            status: 'COMPLETED',
            startedAt: daysAgo(150),
            completedAt: daysAgo(10),
            sessions: {
                create: [
                    { sessionNumber: 1, status: 'COMPLETED', scheduledAt: daysAgo(140) },
                    { sessionNumber: 2, status: 'COMPLETED', scheduledAt: daysAgo(112) },
                    { sessionNumber: 3, status: 'COMPLETED', scheduledAt: daysAgo(84) },
                    { sessionNumber: 4, status: 'COMPLETED', scheduledAt: daysAgo(56) },
                    { sessionNumber: 5, status: 'COMPLETED', scheduledAt: daysAgo(14) },
                ],
            },
        },
        include: { sessions: true },
    });

    // Initial + alle 5 sessionsvurderinger — tydelig stigning
    const saraScoreSeries = [
        { helbred: 3, familie: 5, relationer: 4, karriere: 3, oekonomi: 4, personligUdvikling: 2, fritid: 3, omgivelser: 4 },
        { helbred: 4, familie: 5, relationer: 5, karriere: 4, oekonomi: 4, personligUdvikling: 4, fritid: 4, omgivelser: 5 },
        { helbred: 5, familie: 6, relationer: 6, karriere: 5, oekonomi: 5, personligUdvikling: 6, fritid: 5, omgivelser: 6 },
        { helbred: 6, familie: 7, relationer: 7, karriere: 6, oekonomi: 6, personligUdvikling: 7, fritid: 6, omgivelser: 7 },
        { helbred: 8, familie: 8, relationer: 8, karriere: 7, oekonomi: 7, personligUdvikling: 8, fritid: 7, omgivelser: 8 },
    ];

    const saraNotes = [
        { helbred: 'Kronisk træthed og søvnproblemer.', relationer: 'Ensomhed efter flytning til ny by.', personligUdvikling: 'Lav selvtillid, usikker på fremtiden.' },
        { relationer: 'Har taget kontakt til en gammel veninde.' },
        { helbred: 'Begyndt at gå morgenturer tre gange om ugen.' },
        { karriere: 'Ny ansvarsfuld opgave på arbejdet, føler mig værdsat.' },
        { helbred: 'Energiniveauet er markant forbedret.', personligUdvikling: 'Langt mere tryg i mig selv og mine valg.' },
    ];

    for (let i = 0; i < 5; i++) {
        await prisma.assessment.create({
            data: {
                programmeId: saraProg.id,
                sessionId: saraProg.sessions[i].id,
                isInitial: i === 0,
                isFinal: i === 4,
                completedAt: daysAgo(150 - i * 28),
                scores: saraScoreSeries[i],
                notes: saraNotes[i],
            },
        });
    }

    // Materiale for session 3 og 5
    await prisma.preSessionMaterial.create({
        data: {
            sessionId: saraProg.sessions[2].id,
            pdfContent: '# Session 3 — Energi og vaner\n\nKære Sara,\n\nDu har gjort stor fremgang. Denne session fokuserer på at forankre de sunde vaner, du allerede er begyndt at opbygge...\n\n## Refleksionsøvelse\n1. Hvad giver dig mest energi i hverdagen?\n2. Hvilken ét vane vil du prioritere de næste to uger?',
            videoScript: 'Hej Sara. Vi er nu halvvejs igennem dit forløb, og dine scores viser en rigtig positiv udvikling. Denne uge vil jeg gerne have, at du fokuserer på...',
            generatedAt: daysAgo(86),
            sentAt: daysAgo(85),
        },
    });

    await prisma.preSessionMaterial.create({
        data: {
            sessionId: saraProg.sessions[4].id,
            pdfContent: '# Afsluttende session — Din rejse og vejen frem\n\nKære Sara,\n\nTillykke med at have gennemført dit Mental Klarhed-forløb! Din fremgang er bemærkelsesværdig...\n\n## Din fremgang\nDin samlede gennemsnitsscore er steget fra 3,5 til 7,6 — en forbedring på 117%.',
            videoScript: 'Hej Sara. Du er nået til din afsluttende session, og jeg er oprigtigt imponeret over din rejse. Lad os se tilbage på, hvad du har opnået...',
            generatedAt: daysAgo(16),
            sentAt: daysAgo(14),
        },
    });

    console.log('  ✓ Sara Hansen — COMPLETED, 5 sessioner, fuld scoreprogression');

    // ────────────────────────────────────────────────────────────
    // 2. Anna Nielsen — ACTIVE, session 3 er MATERIAL_GENERATED
    //    → viser "Gennemse materiale" + "Send til klient" knapper
    // ────────────────────────────────────────────────────────────
    const anna = await prisma.client.create({
        data: { email: 'anna.nielsen@example.dk', name: 'Anna Nielsen', locale: 'da', consentAt: daysAgo(80) },
    });

    const annaProg = await prisma.programme.create({
        data: {
            clientId: anna.id,
            status: 'ACTIVE',
            startedAt: daysAgo(70),
            sessions: {
                create: [
                    { sessionNumber: 1, status: 'COMPLETED',          scheduledAt: daysAgo(63) },
                    { sessionNumber: 2, status: 'COMPLETED',          scheduledAt: daysAgo(42) },
                    { sessionNumber: 3, status: 'MATERIAL_GENERATED', scheduledAt: daysFromNow(3) },
                    { sessionNumber: 4, status: 'PENDING',            scheduledAt: daysFromNow(17) },
                    { sessionNumber: 5, status: 'PENDING',            scheduledAt: daysFromNow(31) },
                ],
            },
        },
        include: { sessions: true },
    });

    const annaInitialScores = { helbred: 5, familie: 7, relationer: 6, karriere: 4, oekonomi: 5, personligUdvikling: 4, fritid: 6, omgivelser: 7 };
    const annaS2Scores     = { helbred: 6, familie: 7, relationer: 7, karriere: 5, oekonomi: 5, personligUdvikling: 6, fritid: 6, omgivelser: 7 };
    const annaS3Scores     = { helbred: 7, familie: 8, relationer: 7, karriere: 6, oekonomi: 6, personligUdvikling: 7, fritid: 7, omgivelser: 8 };

    await prisma.assessment.create({
        data: { programmeId: annaProg.id, sessionId: annaProg.sessions[0].id, isInitial: true, completedAt: daysAgo(70), scores: annaInitialScores, notes: { karriere: 'Føler mig fastlåst i min nuværende stilling.', helbred: 'Træthed og hyppige hovedpiner.' } },
    });
    await prisma.assessment.create({
        data: { programmeId: annaProg.id, sessionId: annaProg.sessions[1].id, completedAt: daysAgo(44), scores: annaS2Scores, notes: { helbred: 'Sover markant bedre efter aftenstrategi.', karriere: 'Har talt med leder om udviklingsmuligheder.' } },
    });
    await prisma.assessment.create({
        data: { programmeId: annaProg.id, sessionId: annaProg.sessions[2].id, completedAt: daysAgo(4), scores: annaS3Scores, notes: { personligUdvikling: 'Begyndt at journalføre dagligt — stor forskel.' } },
    });

    await prisma.preSessionMaterial.create({
        data: {
            sessionId: annaProg.sessions[2].id,
            pdfContent: '# Session 3 — Karriere og personlig vækst\n\nKære Anna,\n\nDin score på personlig udvikling er steget fra 4 til 7 — et fantastisk spring!\n\n## Refleksionsøvelse\n1. Hvad har du gjort anderledes siden sidst?\n2. Beskriv en situation, hvor du stod fast ved dine grænser.',
            videoScript: 'Hej Anna. Din fremgang er virkelig inspirerende. Du er gået fra at føle dig fastlåst til at tage aktive skridt mod forandring...',
            generatedAt: daysAgo(2),
        },
    });

    console.log('  ✓ Anna Nielsen — ACTIVE, materiale klar til session 3');

    // ────────────────────────────────────────────────────────────
    // 3. Mikkel Andersen — ACTIVE, session 1 er ASSESSMENT_SENT
    //    → viser at test er sendt men ikke udfyldt endnu
    // ────────────────────────────────────────────────────────────
    const mikkel = await prisma.client.create({
        data: { email: 'mikkel.andersen@example.dk', name: 'Mikkel Andersen', locale: 'da', consentAt: daysAgo(14) },
    });

    const mikkelProg = await prisma.programme.create({
        data: {
            clientId: mikkel.id,
            status: 'ACTIVE',
            startedAt: daysAgo(12),
            sessions: {
                create: [
                    { sessionNumber: 1, status: 'ASSESSMENT_SENT', scheduledAt: daysFromNow(2) },
                    { sessionNumber: 2, status: 'PENDING',         scheduledAt: daysFromNow(16) },
                    { sessionNumber: 3, status: 'PENDING',         scheduledAt: daysFromNow(30) },
                    { sessionNumber: 4, status: 'PENDING',         scheduledAt: daysFromNow(44) },
                    { sessionNumber: 5, status: 'PENDING',         scheduledAt: daysFromNow(58) },
                ],
            },
        },
        include: { sessions: true },
    });

    // Kun initial assessment (udfyldt ved opstart)
    await prisma.assessment.create({
        data: {
            programmeId: mikkelProg.id,
            sessionId: null,
            isInitial: true,
            completedAt: daysAgo(12),
            scores: { helbred: 4, familie: 8, relationer: 5, karriere: 6, oekonomi: 3, personligUdvikling: 5, fritid: 4, omgivelser: 6 },
            notes: { oekonomi: 'Bekymringer om gæld fylder meget i hverdagen.', helbred: 'Rygsmerter fra langt kontorarbejde.', fritid: 'Næsten ingen fritid til egne interesser.' },
        },
    });

    console.log('  ✓ Mikkel Andersen — ACTIVE, test sendt til session 1');

    // ────────────────────────────────────────────────────────────
    // 4. Louise Pedersen — ACTIVE, session 2 er ASSESSMENT_DONE
    //    → AI er i gang med at generere; viser status "Test udfyldt"
    // ────────────────────────────────────────────────────────────
    const louise = await prisma.client.create({
        data: { email: 'louise.pedersen@example.dk', name: 'Louise Pedersen', locale: 'da', consentAt: daysAgo(35) },
    });

    const louiseProg = await prisma.programme.create({
        data: {
            clientId: louise.id,
            status: 'ACTIVE',
            startedAt: daysAgo(28),
            sessions: {
                create: [
                    { sessionNumber: 1, status: 'COMPLETED',       scheduledAt: daysAgo(21) },
                    { sessionNumber: 2, status: 'ASSESSMENT_DONE', scheduledAt: daysFromNow(5) },
                    { sessionNumber: 3, status: 'PENDING',         scheduledAt: daysFromNow(19) },
                    { sessionNumber: 4, status: 'PENDING',         scheduledAt: daysFromNow(33) },
                    { sessionNumber: 5, status: 'PENDING',         scheduledAt: daysFromNow(47) },
                ],
            },
        },
        include: { sessions: true },
    });

    const louiseInitial = { helbred: 6, familie: 6, relationer: 7, karriere: 5, oekonomi: 6, personligUdvikling: 5, fritid: 5, omgivelser: 6 };
    const louiseS2     = { helbred: 7, familie: 7, relationer: 7, karriere: 6, oekonomi: 6, personligUdvikling: 6, fritid: 6, omgivelser: 7 };

    await prisma.assessment.create({
        data: { programmeId: louiseProg.id, sessionId: louiseProg.sessions[0].id, isInitial: true, completedAt: daysAgo(28), scores: louiseInitial, notes: { karriere: 'Ønsker mere meningsfuldt arbejde.', fritid: 'For lidt tid til kreative projekter.' } },
    });
    await prisma.assessment.create({
        data: { programmeId: louiseProg.id, sessionId: louiseProg.sessions[1].id, completedAt: daysAgo(1), scores: louiseS2, notes: { karriere: 'Har undersøgt efteruddannelsesmuligheder.' } },
    });

    console.log('  ✓ Louise Pedersen — ACTIVE, session 2 test udfyldt (materiale genereres)');

    // ────────────────────────────────────────────────────────────
    // 5. Thomas Berg — INVITED, ingen aktivitet endnu
    //    → viser startstadie med kun PENDING-sessioner
    // ────────────────────────────────────────────────────────────
    const thomas = await prisma.client.create({
        data: { email: 'thomas.berg@example.dk', name: 'Thomas Berg', locale: 'da' },
    });

    await prisma.programme.create({
        data: {
            clientId: thomas.id,
            status: 'INVITED',
            sessions: {
                create: [1, 2, 3, 4, 5].map(n => ({
                    sessionNumber: n,
                    status: 'PENDING' as const,
                    scheduledAt: daysFromNow(n * 14),
                })),
            },
        },
    });

    console.log('  ✓ Thomas Berg — INVITED, endnu ingen aktivitet');

    console.log('\n✅ Demo-data klar! 5 klienter:');
    console.log('   Sara Hansen     — COMPLETED (fuld progression fra 3→8)');
    console.log('   Anna Nielsen    — ACTIVE    (materiale klar til session 3)');
    console.log('   Mikkel Andersen — ACTIVE    (test sendt til session 1)');
    console.log('   Louise Pedersen — ACTIVE    (test udfyldt, AI genererer)');
    console.log('   Thomas Berg     — INVITED   (ingen aktivitet endnu)');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());

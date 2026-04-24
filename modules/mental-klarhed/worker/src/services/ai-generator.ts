import { LIVSHJULET_DIMENSIONS, type LivshjuletScores, type LivshjuletNotes } from '@surdej/module-mental-klarhed-shared';

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT ?? '';
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY ?? '';
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';

interface GenerateInput {
    client: { name: string; locale: string };
    session: { sessionNumber: number };
    scores: LivshjuletScores;
    notes: LivshjuletNotes;
    programmeId: string;
}

interface GenerateOutput {
    pdfContent: string;
    videoScript: string;
}

export async function generateMaterial(input: GenerateInput): Promise<GenerateOutput> {
    const { client, session, scores, notes } = input;
    const locale = client.locale as 'da' | 'en';
    const isFinal = session.sessionNumber === 5;

    const dimensionLines = LIVSHJULET_DIMENSIONS.map(d => {
        const score = scores[d.key as keyof LivshjuletScores];
        const note = notes[d.key as keyof LivshjuletNotes] ?? '';
        const label = locale === 'da' ? d.da : d.en;
        return `- ${label}: ${score}/10${note ? ` — "${note}"` : ''}`;
    }).join('\n');

    const systemPrompt = locale === 'da'
        ? `Du er Asger Johannes Steenholdt, erfaren psykoterapeut MPF med over 35 års erfaring.
Du skriver personligt, nærværende og præcist — altid til den konkrete person foran dig.
Skriv på dansk.`
        : `You are Asger Johannes Steenholdt, experienced psychotherapist with over 35 years of experience.
Write personally, presently and precisely — always to the specific person in front of you.
Write in English.`;

    const userPrompt = isFinal
        ? buildFinalPrompt(client.name, dimensionLines, locale)
        : buildSessionPrompt(client.name, session.sessionNumber, dimensionLines, locale);

    const response = await fetch(
        `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-01`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': AZURE_OPENAI_API_KEY,
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: 1500,
                temperature: 0.7,
                response_format: { type: 'json_object' },
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Azure OpenAI error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content) as { pdfContent?: string; videoScript?: string };
    if (!parsed.pdfContent || !parsed.videoScript) {
        throw new Error('Unexpected OpenAI response shape');
    }

    return { pdfContent: parsed.pdfContent, videoScript: parsed.videoScript };
}

function buildSessionPrompt(name: string, sessionNumber: number, dimensionLines: string, locale: string): string {
    if (locale === 'da') {
        return `Klient: ${name}
Session: ${sessionNumber} af 5

Livshjulet-scores:
${dimensionLines}

Generer følgende som JSON:

1. "pdfContent": En PDF-forberedelse på ca. 1 A4-side (markdown-format).
   Strukturér som:
   - Kort personlig introduktion (2-3 sætninger der anerkender klientens scores)
   - De 2-3 dimensioner med lavest score fremhæves
   - 1 opvarmningsøvelse (5 min.)
   - 2 refleksionsspørgsmål (konkrete, dybe)
   - 1 konkret handlingsopgave til ugen

2. "videoScript": Et videomanus til en 90 sekunders personlig video fra Asger (ca. 200 ord).
   Tone: varm, direkte, nærværende — som om Asger taler direkte til ${name}.
   Indhold: anerkend scores → introducer ugens fokus → afslut med invitation til sessionen.

Svar udelukkende som JSON: { "pdfContent": "...", "videoScript": "..." }`;
    }

    return `Client: ${name}
Session: ${sessionNumber} of 5

Life Wheel scores:
${dimensionLines}

Generate the following as JSON:

1. "pdfContent": A PDF preparation (~1 A4 page, markdown format).
   Structure:
   - Short personal intro (2-3 sentences acknowledging the client's scores)
   - Highlight the 2-3 lowest-scoring dimensions
   - 1 warm-up exercise (5 min.)
   - 2 reflection questions (concrete, deep)
   - 1 concrete action task for the week

2. "videoScript": A script for a 90-second personal video from Asger (~200 words).
   Tone: warm, direct, present — as if Asger speaks directly to ${name}.
   Content: acknowledge scores → introduce week's focus → close with an invitation to the session.

Respond only as JSON: { "pdfContent": "...", "videoScript": "..." }`;
}

function buildFinalPrompt(name: string, dimensionLines: string, locale: string): string {
    if (locale === 'da') {
        return `Klient: ${name}
Slutevaluering — session 5 af 5

Livshjulet-scores (slutmåling):
${dimensionLines}

Dette er den afsluttende session. Generer som JSON:

1. "pdfContent": En afsluttende PDF (markdown, ca. 1 A4-side).
   - Anerkend rejsen og klientens indsats
   - Fremhæv de vigtigste erkendelser og fremskridt
   - 2 spørgsmål: "Hvad tager jeg med?" og "Hvad er mit næste skridt?"
   - Afsluttende ord fra Asger

2. "videoScript": Et videomanus til Asgers afsluttende video (ca. 200 ord).
   Varm, anerkendende tone. Fejr fremgangen. Åbn for fortsat støtte.

Svar som JSON: { "pdfContent": "...", "videoScript": "..." }`;
    }

    return `Client: ${name}
Final evaluation — session 5 of 5

Life Wheel scores (final measurement):
${dimensionLines}

This is the closing session. Generate as JSON:

1. "pdfContent": A closing PDF (markdown, ~1 A4 page).
   - Acknowledge the journey and the client's effort
   - Highlight key insights and progress
   - 2 questions: "What do I take with me?" and "What is my next step?"
   - Closing words from Asger

2. "videoScript": A script for Asger's closing video (~200 words).
   Warm, appreciative tone. Celebrate progress. Open for continued support.

Respond as JSON: { "pdfContent": "...", "videoScript": "..." }`;
}

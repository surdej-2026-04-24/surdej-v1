/**
 * MCP-aligned Tools for Surdej Chat
 *
 * Implements prospect tools as Vercel AI SDK v6 `tool()` definitions
 * so GPT-4o can call them during chat conversations.
 *
 * These mirror the MCP server's tools but run in-process for
 * lower latency. The standalone MCP server (@surdej/mcp-prospects)
 * provides the same capabilities for external clients (Claude Desktop,
 * Cursor, VS Code).
 *
 * @module ai/mcp-tools
 */

import { tool } from 'ai';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { uploadBlob } from '../blobs/service.js';

const prisma = new PrismaClient();

// ── Module URLs ─────────────────────────────────────────────────

const OPENAI_MODULE_URL = process.env['OPENAI_MODULE_URL'] || 'http://localhost:7009';

// ── Web Search via SearXNG (self-hosted) ────────────────────────

const SEARXNG_URL = process.env['SEARXNG_URL'] || 'http://searxng:8080';

interface SearxResult {
    title: string;
    url: string;
    content: string;      // snippet
    engine: string;        // which engine found it
    score: number;
    category: string;
}

async function searxngSearch(query: string, maxResults = 5): Promise<SearxResult[]> {
    try {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            categories: 'general',
            language: 'all',
            pageno: '1',
        });

        const res = await fetch(`${SEARXNG_URL}/search?${params}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000), // 15s timeout
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[search_web] SearXNG error:', res.status, errText.slice(0, 200));
            return [];
        }

        const data = await res.json() as { results: SearxResult[] };
        return (data.results ?? []).slice(0, maxResults);
    } catch (err) {
        console.error('[search_web] SearXNG error:', err);
        return [];
    }
}

// ── Embedding helper ────────────────────────────────────────────

async function embedText(text: string): Promise<number[] | null> {
    const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
    const key = process.env['AZURE_OPENAI_API_KEY'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-08-01-preview';
    if (!endpoint || !key) return null;

    try {
        const url = `${endpoint}openai/deployments/text-embedding-3-large/embeddings?api-version=${apiVersion}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'api-key': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: text, dimensions: 3072 }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { data: { embedding: number[] }[] };
        return data.data[0].embedding;
    } catch {
        return null;
    }
}

// ── Tool factory ────────────────────────────────────────────────

/**
 * Build the tools object for the Vercel AI SDK `streamText()` call.
 * Scoped to a specific tenant for data isolation.
 */
export function buildMcpTools(tenantId?: string, userId?: string) {
    return {
        search_web: tool({
            description: 'Search the internet for current information. Use this when the user asks about recent events, needs factual data you are unsure about, or explicitly asks to search the web. Returns results with source URLs from multiple search engines.',
            inputSchema: z.object({
                query: z.string().describe('Search query — be specific and include key terms'),
                maxResults: z.number().int().min(1).max(10).default(5).describe('Number of results to return'),
            }),
            execute: async ({ query, maxResults }: { query: string; maxResults: number }) => {
                console.log(`[search_web] Searching: "${query}" (max=${maxResults})`);
                const results = await searxngSearch(query, maxResults);

                if (results.length === 0) {
                    return {
                        query,
                        resultCount: 0,
                        sources: [],
                        note: 'No results found. The search engine may be starting up — try again in a moment.',
                    };
                }

                return {
                    query,
                    resultCount: results.length,
                    sources: results.map((r, i) => ({
                        rank: i + 1,
                        title: r.title,
                        url: r.url,
                        snippet: r.content?.slice(0, 500) ?? '',
                        engine: r.engine,
                    })),
                };
            },
        }),

        rag_search: tool({
            description: 'Søg semantisk i alle uploadede prospektdokumenter. Finder de mest relevante tekstpassager baseret på indholdet af spørgsmålet. Brug dette til at besvare specifikke spørgsmål om ejendomme, lejeforhold, økonomi, etc.',
            inputSchema: z.object({
                query: z.string().describe('Naturligt sprog-spørgsmål om dokumenterne'),
                limit: z.number().int().min(1).max(10).default(5).describe('Antal chunks at hente'),
            }),
            execute: async ({ query, limit }: { query: string; limit: number }) => {
                const embedding = await embedText(query);
                if (!embedding) return { error: 'Embedding service unavailable', results: [] as never[] };

                const embStr = `[${embedding.join(',')}]`;
                const tenantFilter = tenantId || '';

                const chunks = await prisma.$queryRawUnsafe<{
                    content: string; filename: string; similarity: number; chunkIndex: number;
                }[]>(`
                    SELECT dc.content, b.filename,
                           1 - (dc.embedding <=> $1::vector) AS similarity,
                           dc."chunkIndex"
                    FROM "DocumentChunk" dc
                    JOIN "Blob" b ON b.id = dc."blobId"
                    WHERE ($2 = '' OR dc."tenantId" = $2)
                      AND dc.embedding IS NOT NULL
                    ORDER BY dc.embedding <=> $1::vector
                    LIMIT $3
                `, embStr, tenantFilter, limit);

                return {
                    query,
                    results: chunks.map(c => ({
                        filename: c.filename,
                        chunkIndex: c.chunkIndex + 1,
                        similarity: `${(Number(c.similarity) * 100).toFixed(1)}%`,
                        content: c.content,
                    })),
                };
            },
        }),

        generate_document: tool({
            description: 'Generér og gem et Office-dokument eller en PDF-fil baseret på indhold, struktur eller data (Word, Excel, PowerPoint, PDF). Dokumentet bliver automatisk uploade, og du skal sende brugeren the download link.',
            inputSchema: z.object({
                title: z.string().describe('The title or heading of the document (without extension).'),
                format: z.enum(['pdf', 'docx', 'xlsx', 'pptx']).describe('The document format to generate.'),
                text: z.string().optional().describe('Markdown text content (required for pdf and docx).'),
                data: z.array(z.array(z.string())).optional().describe('2D array of rows and columns (required for xlsx). The first row should be headers.'),
                slides: z.array(z.object({ title: z.string(), content: z.array(z.string()) })).optional().describe('Array of slides with titles and bullet points (required for pptx).')
            }),
            execute: async (req) => {
                const url = process.env['DOCUMENT_EXTRACTOR_URL'] || 'http://document-extractor:8091';
                try {
                    console.log(`[generate_document] Generating ${req.format} file: ${req.title}`);
                    const res = await fetch(`${url}/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(req)
                    });
                    
                    if (!res.ok) {
                        const err = await res.text();
                        console.error('[generate_document] Generator API error:', err);
                        return { error: `Generator failed with status ${res.status}: ${err}` };
                    }
                    
                    const buffer = Buffer.from(await res.arrayBuffer());
                    let mimeType = 'application/octet-stream';
                    if (req.format === 'pdf') mimeType = 'application/pdf';
                    if (req.format === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    if (req.format === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    if (req.format === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    
                    const filename = `${req.title}.${req.format}`;
                    console.log(`[generate_document] Uploading ${filename} to blob storage...`);
                    
                    const blob = await uploadBlob(buffer, {
                        filename,
                        mimeType,
                        sizeBytes: buffer.length,
                        tenantId,
                        userId
                    });
                    
                    return {
                        success: true,
                        message: `Successfully generated ${filename}`,
                        filename,
                        blobId: blob.id,
                        downloadUrl: `/api/blobs/${blob.id}?download=1`
                    };
                } catch (e) {
                    console.error('[generate_document] Exception:', e);
                    return { error: `Generationsfejl: ${(e as Error).message}` };
                }
            }
        }),

        search_properties: tool({
            description: 'Søg og filtrer ejendomme fra uploadede salgsprospekter. Søger i adresse, by, ejendomstype, beskrivelse, lejedata og mere. Returnerer ejendomme med nøgletal som adresse, pris, afkast, lejeindtægt, antal lejemål, type og analysestatus. Brug ALTID dette tool til at besvare spørgsmål om ejendomme, lejedata, lejemål, huslejer, udlejningsejendomme — også opfølgningsspørgsmål med filtre. Kald ALTID dette tool — gæt aldrig at der ikke er data.',
            inputSchema: z.object({
                query: z.string().optional().describe('Fritekst-søgning — matcher adresse, by, ejendomstype, beskrivelse, region, mægler. F.eks. "kontor", "Herning", "bolig", "Vejle"'),
                propertyType: z.string().optional().describe('Filtrer på specifik ejendomstype: Bolig, Kontor, Erhverv, Kontor/Lager, Butik, Mixed, etc.'),
                analyzedOnly: z.boolean().optional().describe('Kun analyserede dokumenter'),
                hasRentalData: z.boolean().optional().describe('Filtrer til kun ejendomme med lejedata (har lejeindtægt og/eller antal lejemål)'),
                limit: z.number().int().min(1).max(50).default(20).describe('Max antal resultater'),
            }),
            execute: async ({ query, propertyType, analyzedOnly, hasRentalData, limit }: { query?: string; propertyType?: string; analyzedOnly?: boolean; hasRentalData?: boolean; limit: number }) => {
                // Fetch all analyzed PDFs — we filter in-memory because search targets JSONB analysis data
                const blobs = await prisma.blob.findMany({
                    where: {
                        tenantId: tenantId || undefined,
                        mimeType: 'application/pdf',
                        deletedAt: null,
                    } as any,
                    take: 200, // fetch more, filter below
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, filename: true, sizeBytes: true,
                        metadata: true, analysis: true, createdAt: true,
                    },
                });

                const queryLower = query?.toLowerCase().trim();
                const typeLower = propertyType?.toLowerCase().trim();

                const results = blobs
                    .filter(b => {
                        const meta = b.metadata as Record<string, unknown> | null;
                        if (analyzedOnly && !meta?.analyzed) return false;
                        return true;
                    })
                    .map(b => {
                        const meta = b.metadata as Record<string, unknown> | null;
                        const analysis = b.analysis as Record<string, unknown> | null;
                        const property = analysis?.property as Record<string, unknown> | null;
                        const financials = analysis?.financials as Record<string, unknown> | null;
                        const addressWash = analysis?.addressWash as Record<string, unknown> | null;
                        return {
                            id: b.id,
                            filename: b.filename,
                            status: String(meta?.status ?? 'unknown'),
                            quality: meta?.qualityScore as number | null ?? null,
                            analyzed: meta?.analyzed === true,
                            address: String(property?.address ?? addressWash?.fullAddress ?? ''),
                            _washedAddress: String(addressWash?.fullAddress ?? ''),
                            postalCode: String(addressWash?.postalCode ?? property?.postalCode ?? ''),
                            city: String(addressWash?.city ?? property?.city ?? ''),
                            municipality: String(property?.municipality ?? ''),
                            region: String(property?.region ?? ''),
                            propertyType: String(property?.propertyType ?? ''),
                            price: (financials?.salePrice ?? financials?.purchasePrice ?? null) as number | null,
                            netYield: (financials?.netYield ?? null) as number | null,
                            annualRent: (financials?.annualRentIncome ?? null) as number | null,
                            numberOfUnits: (property?.numberOfUnits ?? null) as number | null,
                            hasRentalData: !!((financials?.annualRentIncome as number) || (property?.numberOfUnits as number)),
                            constructionYear: (property?.constructionYear ?? null) as number | null,
                            energyRating: String(property?.energyRating ?? ''),
                            summary: String(analysis?.summary ?? ''),
                        };
                    })
                    .filter(r => {
                        // Filter by propertyType if specified
                        if (typeLower && !r.propertyType.toLowerCase().includes(typeLower)) return false;

                        // Filter by rental data presence
                        if (hasRentalData && !r.hasRentalData) return false;

                        // Full-text search across all analysis fields
                        if (queryLower) {
                            // Strip generic terms that are filter-intent, not search terms
                            const skipWords = new Set(['lejedata', 'lejer', 'lejemål', 'husleje', 'huslejer', 'udlejning', 'rental', 'data', 'med', 'alle', 'vis', 'show', 'find', 'ejendomme', 'properties']);
                            const searchable = [
                                r.address, r._washedAddress,
                                r.city, r.municipality, r.region,
                                r.propertyType, r.summary, r.filename, r.postalCode,
                            ].join(' ').toLowerCase();
                            // Match if ALL non-skip query words are found somewhere in the searchable fields
                            const words = queryLower.split(/\s+/).filter(w => w.length > 1 && !skipWords.has(w));
                            if (words.length > 0) {
                                return words.every(w => searchable.includes(w));
                            }
                        }
                        return true;
                    })
                    .map(({ _washedAddress, ...rest }) => rest) // Strip internal field
                    .slice(0, limit);

                return { total: results.length, properties: results };
            },
        }),

        get_property: tool({
            description: 'Hent detaljeret information om en specifik ejendom inklusiv fuld AI-analyse, økonomiske data, lejeforhold og dokumentchunks.',
            inputSchema: z.object({
                propertyId: z.string().describe('Blob ID (UUID) for ejendomsdokumentet'),
            }),
            execute: async ({ propertyId }: { propertyId: string }) => {
                const blob = await prisma.blob.findUnique({
                    where: { id: propertyId },
                    include: {
                        chunks: {
                            select: { chunkIndex: true, tokenCount: true, content: true },
                            orderBy: { chunkIndex: 'asc' },
                        },
                    },
                });

                if (!blob) return { error: 'Ejendom ikke fundet', id: '', filename: '' };

                const meta = blob.metadata as Record<string, unknown> | null;
                const analysis = blob.analysis as Record<string, unknown> | null;

                return {
                    id: blob.id,
                    filename: blob.filename,
                    status: String(meta?.status ?? 'unknown'),
                    quality: meta?.qualityScore as number | null ?? null,
                    pages: meta?.pageCount as number | null ?? null,
                    analysis: analysis ?? {},
                    chunks: blob.chunks.map(c => ({
                        index: c.chunkIndex,
                        tokens: c.tokenCount,
                        preview: c.content.slice(0, 400),
                    })),
                };
            },
        }),

        compute_yield: tool({
            description: 'Beregn nettoafkast/startforrentning ud fra finansielle data. Brug enten direkte tal eller et property ID til at hente gemte data.',
            inputSchema: z.object({
                annualRent: z.number().optional().describe('Samlet årlig lejeindtægt (DKK)'),
                operatingExpenses: z.number().optional().describe('Årlige driftsudgifter (DKK)'),
                purchasePrice: z.number().optional().describe('Kontantpris/købspris (DKK)'),
                propertyId: z.string().optional().describe('Blob ID til at hente gemte økonomiske data'),
            }),
            execute: async ({ annualRent, operatingExpenses, purchasePrice, propertyId }: {
                annualRent?: number; operatingExpenses?: number; purchasePrice?: number; propertyId?: string;
            }) => {
                let rent = annualRent;
                let expenses = operatingExpenses;
                let price = purchasePrice;

                if (propertyId) {
                    const blob = await prisma.blob.findUnique({
                        where: { id: propertyId }, select: { analysis: true },
                    });
                    const financials = (blob?.analysis as any)?.financials;
                    if (financials) {
                        rent = rent ?? financials.annualRentIncome ?? financials.annualRent;
                        expenses = expenses ?? financials.annualOperatingCosts ?? financials.operatingExpenses;
                        price = price ?? financials.salePrice ?? financials.purchasePrice;
                    }
                }

                if (!rent || !price) {
                    return {
                        error: 'Ikke nok data. Angiv annualRent + purchasePrice.',
                        netYieldPercent: '0%', calculation: '',
                    };
                }

                const netIncome = rent - (expenses ?? 0);
                const netYield = netIncome / price;

                return {
                    annualRent: rent,
                    operatingExpenses: expenses ?? 0,
                    netIncome,
                    purchasePrice: price,
                    netYield,
                    netYieldPercent: `${(netYield * 100).toFixed(2)}%`,
                    calculation: `(${rent.toLocaleString('da-DK')} - ${(expenses ?? 0).toLocaleString('da-DK')}) / ${price.toLocaleString('da-DK')} = ${(netYield * 100).toFixed(2)}%`,
                };
            },
        }),

        list_documents: tool({
            description: 'List alle uploadede dokumenter med processerings-status, kvalitetsscore og analysestatus.',
            inputSchema: z.object({
                status: z.enum(['queued', 'processing', 'completed', 'failed']).optional().describe('Filtrer efter status'),
            }),
            execute: async ({ status }: { status?: string }) => {
                const blobs = await prisma.blob.findMany({
                    where: {
                        tenantId: tenantId || undefined,
                        mimeType: 'application/pdf',
                        deletedAt: null,
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, filename: true, sizeBytes: true, metadata: true, createdAt: true },
                });

                const results = blobs
                    .filter(b => {
                        if (!status) return true;
                        return (b.metadata as any)?.status === status;
                    })
                    .map(b => {
                        const meta = b.metadata as Record<string, unknown> | null;
                        return {
                            id: b.id,
                            filename: b.filename,
                            sizeMB: (b.sizeBytes / 1024 / 1024).toFixed(1),
                            status: String(meta?.status ?? 'unknown'),
                            quality: meta?.qualityScore as number | null ?? null,
                            pages: meta?.pageCount as number | null ?? null,
                            analyzed: meta?.analyzed === true,
                        };
                    });

                return { total: results.length, documents: results };
            },
        }),

        // ── OpenAI Studio Tools (core-openai module) ────────────────

        openai_generate_image: tool({
            description: 'Generate an image from a text description using DALL-E or GPT Image. Returns a URL to the generated image.',
            inputSchema: z.object({
                prompt: z.string().describe('Detailed description of the image to generate'),
                model: z.enum(['dall-e-2', 'dall-e-3', 'gpt-image-1']).default('dall-e-3').describe('Image generation model'),
                size: z.enum(['1024x1024', '1024x1792', '1792x1024']).default('1024x1024').describe('Image dimensions'),
            }),
            execute: async ({ prompt, model, size }: { prompt: string; model: string; size: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/text-to-image`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, model, size }),
                        signal: AbortSignal.timeout(120_000),
                    });
                    if (!res.ok) return { error: `Image generation failed: ${res.status}` };
                    return await res.json();
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),

        openai_analyze_image: tool({
            description: 'Analyze and describe an image using GPT-4o vision. Provide an image URL and optional question.',
            inputSchema: z.object({
                imageUrl: z.string().describe('URL of the image to analyze'),
                prompt: z.string().default('Describe this image in detail.').describe('Question or instruction about the image'),
            }),
            execute: async ({ imageUrl, prompt }: { imageUrl: string; prompt: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/image-to-text`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl, prompt }),
                        signal: AbortSignal.timeout(60_000),
                    });
                    if (!res.ok) return { error: `Image analysis failed: ${res.status}` };
                    return await res.json();
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),

        openai_transcribe_audio: tool({
            description: 'Transcribe audio to text using OpenAI Whisper. Provide a URL to an audio file (mp3, wav, m4a, etc.).',
            inputSchema: z.object({
                audioUrl: z.string().describe('URL of the audio file to transcribe'),
                language: z.string().optional().describe('Language code (e.g. "en", "da", "de")'),
            }),
            execute: async ({ audioUrl, language }: { audioUrl: string; language?: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/speech-to-text`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ audioUrl, language, responseFormat: 'verbose_json' }),
                        signal: AbortSignal.timeout(120_000),
                    });
                    if (!res.ok) return { error: `Transcription failed: ${res.status}` };
                    return await res.json();
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),

        openai_text_to_speech: tool({
            description: 'Convert text to spoken audio using OpenAI TTS. Returns base64-encoded audio.',
            inputSchema: z.object({
                input: z.string().describe('Text to convert to speech (max 4096 chars)'),
                voice: z.enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']).default('alloy').describe('Voice to use'),
            }),
            execute: async ({ input, voice }: { input: string; voice: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/text-to-speech`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ input: input.slice(0, 4096), voice }),
                        signal: AbortSignal.timeout(60_000),
                    });
                    if (!res.ok) return { error: `TTS failed: ${res.status}` };
                    const data = await res.json();
                    return { success: true, format: data.format, contentType: data.contentType, audioLength: data.audioBase64?.length ?? 0 };
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),

        openai_count_tokens: tool({
            description: 'Estimate token count and cost for text input across OpenAI models.',
            inputSchema: z.object({
                text: z.string().describe('Text to estimate tokens for'),
                model: z.string().default('gpt-4o').describe('Model to estimate cost for'),
            }),
            execute: async ({ text, model }: { text: string; model: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/count-tokens`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text, model }),
                    });
                    if (!res.ok) return { error: `Token count failed: ${res.status}` };
                    return await res.json();
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),

        openai_moderate_content: tool({
            description: 'Check text content against OpenAI moderation policies. Returns flagged categories and scores.',
            inputSchema: z.object({
                input: z.string().describe('Text content to check for policy violations'),
            }),
            execute: async ({ input }: { input: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/moderation`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ input }),
                    });
                    if (!res.ok) return { error: `Moderation failed: ${res.status}` };
                    return await res.json();
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),

        openai_generate_embeddings: tool({
            description: 'Generate vector embeddings for text using OpenAI embedding models. Useful for semantic search and similarity.',
            inputSchema: z.object({
                input: z.string().describe('Text to generate embeddings for'),
                model: z.enum(['text-embedding-3-small', 'text-embedding-3-large']).default('text-embedding-3-small').describe('Embedding model'),
            }),
            execute: async ({ input, model }: { input: string; model: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/embeddings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ input, model }),
                    });
                    if (!res.ok) return { error: `Embedding failed: ${res.status}` };
                    const data = await res.json();
                    return { model: data.model, dimensions: data.embeddings?.[0]?.values?.length ?? 0, usage: data.usage };
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),

        openai_list_models: tool({
            description: 'List available OpenAI models with capabilities, pricing, and limits.',
            inputSchema: z.object({
                category: z.enum(['chat', 'image', 'audio', 'embedding', 'moderation', 'reasoning']).optional().describe('Filter by model category'),
            }),
            execute: async ({ category }: { category?: string }) => {
                try {
                    const res = await fetch(`${OPENAI_MODULE_URL}/models`);
                    if (!res.ok) return { error: `Model catalog failed: ${res.status}` };
                    const data = await res.json();
                    const models = category
                        ? data.models.filter((m: any) => m.category === category)
                        : data.models;
                    return { total: models.length, models };
                } catch (e) { return { error: (e as Error).message }; }
            },
        }),
    };
}

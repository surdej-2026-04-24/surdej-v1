import { z } from 'zod';

export const MODULE_NAME = 'core-openai';

// ─── Surfaces ──────────────────────────────────────────────────

export const AiSurface = z.enum([
    'module-page',   // Standalone UI pages under /modules/core-openai
    'chat',          // Available as MCP tools in /chat
    'quick-chat',    // Available in the toolbar flyover
    'extension',     // Available as session tools in the Chrome extension
    'command-palette', // Accessible via ⌘K
]);
export type AiSurface = z.infer<typeof AiSurface>;

// ─── NATS Subjects ─────────────────────────────────────────────

export const NATS_SUBJECTS = {
    register: 'module.register',
    deregister: 'module.deregister',
    heartbeat: 'module.heartbeat',
    events: `module.${MODULE_NAME}.>`,
} as const;

// ─── Job Types ─────────────────────────────────────────────────

export const AiJobType = z.enum([
    'text-to-image',
    'image-to-text',
    'image-to-image',
    'video-analysis',
    'chat',
]);
export type AiJobType = z.infer<typeof AiJobType>;

export const AiJobStatus = z.enum([
    'pending',
    'processing',
    'completed',
    'failed',
]);
export type AiJobStatus = z.infer<typeof AiJobStatus>;

// ─── Core AiJob Schema ────────────────────────────────────────

export const AiJobSchema = z.object({
    id: z.string().uuid(),
    type: AiJobType,
    status: AiJobStatus,
    prompt: z.string().optional(),
    inputUrl: z.string().url().optional(),
    result: z.string().optional(),
    resultUrl: z.string().url().optional(),
    model: z.string().optional(),
    error: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type AiJob = z.infer<typeof AiJobSchema>;

export const AiJobListResponseSchema = z.object({
    items: z.array(AiJobSchema),
    total: z.number(),
});
export type AiJobListResponse = z.infer<typeof AiJobListResponseSchema>;

// ─── Text-to-Image Request ────────────────────────────────────

export const TextToImageRequestSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    model: z.enum(['dall-e-2', 'dall-e-3', 'gpt-image-1']).default('dall-e-3'),
    size: z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024']).default('1024x1024'),
    quality: z.enum(['standard', 'hd', 'low', 'medium', 'high']).default('standard'),
    n: z.number().int().min(1).max(10).default(1),
});
export type TextToImageRequest = z.infer<typeof TextToImageRequestSchema>;

export const TextToImageResponseSchema = z.object({
    jobId: z.string().uuid(),
    images: z.array(z.object({
        url: z.string().optional(),
        b64_json: z.string().optional(),
        revised_prompt: z.string().optional(),
    })),
});
export type TextToImageResponse = z.infer<typeof TextToImageResponseSchema>;

// ─── Image-to-Text Request (Vision) ──────────────────────────

export const ImageToTextRequestSchema = z.object({
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().optional(),
    prompt: z.string().default('Describe this image in detail.'),
    model: z.enum(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini']).default('gpt-4o'),
    maxTokens: z.number().int().min(1).max(16384).default(1024),
}).refine(
    data => data.imageUrl || data.imageBase64,
    { message: 'Either imageUrl or imageBase64 must be provided' },
);
export type ImageToTextRequest = z.infer<typeof ImageToTextRequestSchema>;

export const ImageToTextResponseSchema = z.object({
    jobId: z.string().uuid(),
    description: z.string(),
    model: z.string(),
    usage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
    }).optional(),
});
export type ImageToTextResponse = z.infer<typeof ImageToTextResponseSchema>;

// ─── Image-to-Image Request (Edit) ───────────────────────────

export const ImageToImageRequestSchema = z.object({
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().optional(),
    prompt: z.string().min(1, 'Edit prompt is required'),
    model: z.enum(['dall-e-2', 'gpt-image-1']).default('gpt-image-1'),
    size: z.enum(['256x256', '512x512', '1024x1024']).default('1024x1024'),
    n: z.number().int().min(1).max(10).default(1),
}).refine(
    data => data.imageUrl || data.imageBase64,
    { message: 'Either imageUrl or imageBase64 must be provided' },
);
export type ImageToImageRequest = z.infer<typeof ImageToImageRequestSchema>;

export const ImageToImageResponseSchema = z.object({
    jobId: z.string().uuid(),
    images: z.array(z.object({
        url: z.string().optional(),
        b64_json: z.string().optional(),
    })),
});
export type ImageToImageResponse = z.infer<typeof ImageToImageResponseSchema>;

// ─── Video Analysis Request ──────────────────────────────────

export const VideoAnalysisRequestSchema = z.object({
    videoUrl: z.string().url().optional(),
    frames: z.array(z.object({
        imageUrl: z.string().url().optional(),
        imageBase64: z.string().optional(),
        timestamp: z.string().optional(),
    })).optional(),
    prompt: z.string().default('Analyze this video and describe what is happening.'),
    model: z.enum(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini']).default('gpt-4o'),
    maxTokens: z.number().int().min(1).max(16384).default(2048),
}).refine(
    data => data.videoUrl || (data.frames && data.frames.length > 0),
    { message: 'Either videoUrl or frames must be provided' },
);
export type VideoAnalysisRequest = z.infer<typeof VideoAnalysisRequestSchema>;

export const VideoAnalysisResponseSchema = z.object({
    jobId: z.string().uuid(),
    analysis: z.string(),
    model: z.string(),
    frameCount: z.number().optional(),
    usage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
    }).optional(),
});
export type VideoAnalysisResponse = z.infer<typeof VideoAnalysisResponseSchema>;

// ─── Chat Completion Request ─────────────────────────────────

export const ChatMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.union([
        z.string(),
        z.array(z.object({
            type: z.enum(['text', 'image_url']),
            text: z.string().optional(),
            image_url: z.object({
                url: z.string(),
                detail: z.enum(['auto', 'low', 'high']).default('auto'),
            }).optional(),
        })),
    ]),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    model: z.enum(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini']).default('gpt-4o'),
    maxTokens: z.number().int().min(1).max(128000).default(4096),
    temperature: z.number().min(0).max(2).default(1),
    stream: z.boolean().default(false),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
    jobId: z.string().uuid(),
    message: z.object({
        role: z.literal('assistant'),
        content: z.string(),
    }),
    model: z.string(),
    usage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
    }).optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ─── Benchmark Request ───────────────────────────────────────

export const BenchmarkRequestSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    models: z.array(z.string()).min(2, 'At least 2 models required').max(6),
    maxTokens: z.number().int().min(1).max(16384).default(1024),
    temperature: z.number().min(0).max(2).default(1),
    runs: z.number().int().min(1).max(5).default(1),
});
export type BenchmarkRequest = z.infer<typeof BenchmarkRequestSchema>;

export const BenchmarkResultSchema = z.object({
    model: z.string(),
    response: z.string(),
    latencyMs: z.number(),
    tokensUsed: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
    }).optional(),
    estimatedCost: z.number().optional(),
    error: z.string().optional(),
});
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

export const BenchmarkResponseSchema = z.object({
    jobId: z.string().uuid(),
    prompt: z.string(),
    results: z.array(BenchmarkResultSchema),
    timestamp: z.string().datetime(),
});
export type BenchmarkResponse = z.infer<typeof BenchmarkResponseSchema>;

// ─── Prompt Playground Request ───────────────────────────────

export const PlaygroundRequestSchema = z.object({
    prompt: z.string().min(1),
    systemPrompt: z.string().optional(),
    model: z.string().default('gpt-4o'),
    maxTokens: z.number().int().min(1).max(128000).default(4096),
    temperature: z.number().min(0).max(2).default(1),
    topP: z.number().min(0).max(1).default(1),
    frequencyPenalty: z.number().min(-2).max(2).default(0),
    presencePenalty: z.number().min(-2).max(2).default(0),
    stop: z.array(z.string()).optional(),
});
export type PlaygroundRequest = z.infer<typeof PlaygroundRequestSchema>;

export const PlaygroundResponseSchema = z.object({
    jobId: z.string().uuid(),
    response: z.string(),
    model: z.string(),
    latencyMs: z.number(),
    usage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
    }).optional(),
    finishReason: z.string().optional(),
});
export type PlaygroundResponse = z.infer<typeof PlaygroundResponseSchema>;

// ─── Token Counter / Cost Estimator ──────────────────────────

export const TokenCountRequestSchema = z.object({
    text: z.string().min(1),
    model: z.string().default('gpt-4o'),
});
export type TokenCountRequest = z.infer<typeof TokenCountRequestSchema>;

export const TokenCountResponseSchema = z.object({
    tokenCount: z.number(),
    model: z.string(),
    estimatedCost: z.object({
        inputCostPer1k: z.number(),
        outputCostPer1k: z.number(),
        estimatedInputCost: z.number(),
    }),
});
export type TokenCountResponse = z.infer<typeof TokenCountResponseSchema>;

// ─── Speech-to-Text (Whisper) ────────────────────────────────

export const SpeechToTextRequestSchema = z.object({
    audioUrl: z.string().url().optional(),
    audioBase64: z.string().optional(),
    model: z.enum(['whisper-1']).default('whisper-1'),
    language: z.string().optional(),
    prompt: z.string().optional(),
    responseFormat: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).default('json'),
    temperature: z.number().min(0).max(1).default(0),
}).refine(
    data => data.audioUrl || data.audioBase64,
    { message: 'Either audioUrl or audioBase64 must be provided' },
);
export type SpeechToTextRequest = z.infer<typeof SpeechToTextRequestSchema>;

export const SpeechToTextResponseSchema = z.object({
    jobId: z.string().uuid(),
    text: z.string(),
    language: z.string().optional(),
    duration: z.number().optional(),
    segments: z.array(z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
    })).optional(),
});
export type SpeechToTextResponse = z.infer<typeof SpeechToTextResponseSchema>;

// ─── Text-to-Speech ─────────────────────────────────────────

export const TextToSpeechRequestSchema = z.object({
    input: z.string().min(1).max(4096),
    model: z.enum(['tts-1', 'tts-1-hd']).default('tts-1'),
    voice: z.enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']).default('alloy'),
    responseFormat: z.enum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']).default('mp3'),
    speed: z.number().min(0.25).max(4).default(1),
});
export type TextToSpeechRequest = z.infer<typeof TextToSpeechRequestSchema>;

export const TextToSpeechResponseSchema = z.object({
    jobId: z.string().uuid(),
    audioBase64: z.string(),
    format: z.string(),
    contentType: z.string(),
});
export type TextToSpeechResponse = z.infer<typeof TextToSpeechResponseSchema>;

// ─── Embeddings Generator ───────────────────────────────────

export const EmbeddingsRequestSchema = z.object({
    input: z.union([z.string(), z.array(z.string())]),
    model: z.enum(['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']).default('text-embedding-3-small'),
    dimensions: z.number().int().min(1).max(3072).optional(),
});
export type EmbeddingsRequest = z.infer<typeof EmbeddingsRequestSchema>;

export const EmbeddingsResponseSchema = z.object({
    jobId: z.string().uuid(),
    embeddings: z.array(z.object({
        index: z.number(),
        values: z.array(z.number()),
    })),
    model: z.string(),
    usage: z.object({
        promptTokens: z.number(),
        totalTokens: z.number(),
    }),
});
export type EmbeddingsResponse = z.infer<typeof EmbeddingsRequestSchema>;

// ─── Moderation Check ───────────────────────────────────────

export const ModerationRequestSchema = z.object({
    input: z.union([z.string(), z.array(z.string())]),
    model: z.enum(['omni-moderation-latest', 'text-moderation-latest', 'text-moderation-stable']).default('omni-moderation-latest'),
});
export type ModerationRequest = z.infer<typeof ModerationRequestSchema>;

export const ModerationResultSchema = z.object({
    flagged: z.boolean(),
    categories: z.record(z.boolean()),
    categoryScores: z.record(z.number()),
});
export type ModerationResult = z.infer<typeof ModerationResultSchema>;

export const ModerationResponseSchema = z.object({
    jobId: z.string().uuid(),
    results: z.array(ModerationResultSchema),
});
export type ModerationResponse = z.infer<typeof ModerationResponseSchema>;

// ─── Model Catalog ──────────────────────────────────────────

export const ModelInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    provider: z.literal('openai'),
    category: z.enum(['chat', 'image', 'audio', 'embedding', 'moderation', 'reasoning']),
    capabilities: z.array(z.string()),
    maxTokens: z.number().optional(),
    inputCostPer1k: z.number().optional(),
    outputCostPer1k: z.number().optional(),
    deprecated: z.boolean().default(false),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const ModelCatalogResponseSchema = z.object({
    models: z.array(ModelInfoSchema),
    updatedAt: z.string().datetime(),
});
export type ModelCatalogResponse = z.infer<typeof ModelCatalogResponseSchema>;

// ─── Surface Configuration ──────────────────────────────────

/** Which capabilities are available on which surfaces */
export const SURFACE_CAPABILITIES: Record<string, AiSurface[]> = {
    'text-to-image': ['module-page', 'chat', 'quick-chat', 'extension', 'command-palette'],
    'image-to-text': ['module-page', 'chat', 'quick-chat', 'extension', 'command-palette'],
    'image-to-image': ['module-page', 'chat', 'extension', 'command-palette'],
    'video-analysis': ['module-page', 'chat', 'extension', 'command-palette'],
    'chat': ['module-page', 'chat', 'quick-chat', 'extension', 'command-palette'],
    'benchmark': ['module-page', 'command-palette'],
    'playground': ['module-page', 'command-palette'],
    'count-tokens': ['module-page', 'chat', 'quick-chat', 'extension', 'command-palette'],
    'speech-to-text': ['module-page', 'chat', 'extension', 'command-palette'],
    'text-to-speech': ['module-page', 'chat', 'extension', 'command-palette'],
    'embeddings': ['module-page', 'chat', 'extension', 'command-palette'],
    'moderation': ['module-page', 'chat', 'quick-chat', 'extension', 'command-palette'],
    'models': ['module-page', 'chat', 'quick-chat', 'command-palette'],
};

/** Get capabilities available on a given surface */
export function getCapabilitiesForSurface(surface: AiSurface): string[] {
    return Object.entries(SURFACE_CAPABILITIES)
        .filter(([, surfaces]) => surfaces.includes(surface))
        .map(([capability]) => capability);
}

/** Check if a capability is available on a surface */
export function isCapabilityAvailable(capability: string, surface: AiSurface): boolean {
    return SURFACE_CAPABILITIES[capability]?.includes(surface) ?? false;
}

import {
    MODULE_NAME,
    AiJobSchema,
    AiJobListResponseSchema,
    type AiJob,
    type AiJobListResponse,
    type TextToImageRequest,
    type TextToImageResponse,
    type ImageToTextRequest,
    type ImageToTextResponse,
    type ImageToImageRequest,
    type ImageToImageResponse,
    type VideoAnalysisRequest,
    type VideoAnalysisResponse,
    type ChatRequest,
    type ChatResponse,
    type BenchmarkRequest,
    type BenchmarkResponse,
    type PlaygroundRequest,
    type PlaygroundResponse,
    type TokenCountRequest,
    type TokenCountResponse,
    type SpeechToTextRequest,
    type SpeechToTextResponse,
    type TextToSpeechRequest,
    type TextToSpeechResponse,
    type EmbeddingsRequest,
    type EmbeddingsResponse,
    type ModerationRequest,
    type ModerationResponse,
    type ModelCatalogResponse,
} from '@surdej/module-core-openai-shared';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useModuleApi() {
    return {
        // Job management
        listJobs: async (): Promise<AiJobListResponse> => {
            const data = await request<unknown>('/');
            return AiJobListResponseSchema.parse(data);
        },
        getJob: async (id: string): Promise<AiJob> => {
            const data = await request<unknown>(`/${id}`);
            return AiJobSchema.parse(data);
        },

        // Text to Image
        textToImage: async (input: TextToImageRequest): Promise<TextToImageResponse> => {
            return request<TextToImageResponse>('/text-to-image', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Image to Text (Vision)
        imageToText: async (input: ImageToTextRequest): Promise<ImageToTextResponse> => {
            return request<ImageToTextResponse>('/image-to-text', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Image to Image (Edit)
        imageToImage: async (input: ImageToImageRequest): Promise<ImageToImageResponse> => {
            return request<ImageToImageResponse>('/image-to-image', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Video Analysis
        videoAnalysis: async (input: VideoAnalysisRequest): Promise<VideoAnalysisResponse> => {
            return request<VideoAnalysisResponse>('/video-analysis', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Chat Completion
        chat: async (input: ChatRequest): Promise<ChatResponse> => {
            return request<ChatResponse>('/chat', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Streaming Chat
        chatStream: async (
            input: Omit<ChatRequest, 'stream'>,
            onChunk: (content: string) => void,
            onDone?: () => void,
        ): Promise<void> => {
            const res = await fetch(`${BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...input, stream: true }),
            });
            if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const payload = JSON.parse(line.slice(6));
                        if (payload.done) {
                            onDone?.();
                        } else if (payload.content) {
                            onChunk(payload.content);
                        }
                    }
                }
            }
        },

        // Benchmark
        benchmark: async (input: BenchmarkRequest): Promise<BenchmarkResponse> => {
            return request<BenchmarkResponse>('/benchmark', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Prompt Playground
        playground: async (input: PlaygroundRequest): Promise<PlaygroundResponse> => {
            return request<PlaygroundResponse>('/playground', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Token Counter
        countTokens: async (input: TokenCountRequest): Promise<TokenCountResponse> => {
            return request<TokenCountResponse>('/count-tokens', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Speech to Text
        speechToText: async (input: SpeechToTextRequest): Promise<SpeechToTextResponse> => {
            return request<SpeechToTextResponse>('/speech-to-text', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Text to Speech
        textToSpeech: async (input: TextToSpeechRequest): Promise<TextToSpeechResponse> => {
            return request<TextToSpeechResponse>('/text-to-speech', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Embeddings
        embeddings: async (input: EmbeddingsRequest): Promise<{ embeddings: { index: number; values: number[] }[]; model: string; usage: { promptTokens: number; totalTokens: number } }> => {
            return request('/embeddings', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Moderation
        moderation: async (input: ModerationRequest): Promise<ModerationResponse> => {
            return request<ModerationResponse>('/moderation', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // Model Catalog
        getModels: async (): Promise<ModelCatalogResponse> => {
            return request<ModelCatalogResponse>('/models');
        },
    };
}

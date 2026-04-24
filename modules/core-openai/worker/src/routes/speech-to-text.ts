import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import { SpeechToTextRequestSchema } from '@surdej/module-core-openai-shared';
import { Readable } from 'node:stream';

export function registerSpeechToTextRoutes(app: FastifyInstance) {
    app.post('/speech-to-text', async (req, reply) => {
        const result = SpeechToTextRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { audioUrl, audioBase64, model, language, prompt: hintPrompt, responseFormat, temperature } = result.data;
        const jobId = crypto.randomUUID();
        const openai = getOpenAIClient();

        try {
            let audioFile: File;

            if (audioUrl) {
                const res = await fetch(audioUrl);
                if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
                const blob = await res.blob();
                audioFile = new File([blob], 'audio.mp3', { type: blob.type || 'audio/mpeg' });
            } else {
                const buffer = Buffer.from(audioBase64!, 'base64');
                audioFile = new File([buffer], 'audio.mp3', { type: 'audio/mpeg' });
            }

            const transcription = await openai.audio.transcriptions.create({
                file: audioFile,
                model,
                language,
                prompt: hintPrompt,
                response_format: responseFormat,
                temperature,
            });

            // Handle different response formats
            const text = typeof transcription === 'string' ? transcription : transcription.text;
            const segments = typeof transcription === 'object' && 'segments' in transcription
                ? (transcription as { segments?: Array<{ start: number; end: number; text: string }> }).segments?.map(s => ({
                    start: s.start,
                    end: s.end,
                    text: s.text,
                }))
                : undefined;
            const duration = typeof transcription === 'object' && 'duration' in transcription
                ? (transcription as { duration?: number }).duration
                : undefined;

            return reply.status(201).send({
                jobId,
                text,
                language,
                duration,
                segments,
            });
        } catch (err) {
            return reply.status(500).send({
                error: err instanceof Error ? err.message : 'Unknown error',
                jobId,
            });
        }
    });
}

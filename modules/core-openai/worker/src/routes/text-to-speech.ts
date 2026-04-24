import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import { TextToSpeechRequestSchema } from '@surdej/module-core-openai-shared';

const FORMAT_CONTENT_TYPES: Record<string, string> = {
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    aac: 'audio/aac',
    flac: 'audio/flac',
    wav: 'audio/wav',
    pcm: 'audio/pcm',
};

export function registerTextToSpeechRoutes(app: FastifyInstance) {
    app.post('/text-to-speech', async (req, reply) => {
        const result = TextToSpeechRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { input, model, voice, responseFormat, speed } = result.data;
        const jobId = crypto.randomUUID();
        const openai = getOpenAIClient();

        try {
            const response = await openai.audio.speech.create({
                model,
                voice,
                input,
                response_format: responseFormat,
                speed,
            });

            const arrayBuffer = await response.arrayBuffer();
            const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = FORMAT_CONTENT_TYPES[responseFormat] ?? 'audio/mpeg';

            return reply.status(201).send({
                jobId,
                audioBase64,
                format: responseFormat,
                contentType,
            });
        } catch (err) {
            return reply.status(500).send({
                error: err instanceof Error ? err.message : 'Unknown error',
                jobId,
            });
        }
    });
}

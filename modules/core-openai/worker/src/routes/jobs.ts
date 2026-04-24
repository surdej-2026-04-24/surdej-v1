import type { FastifyInstance } from 'fastify';
import type { AiJob } from '@surdej/module-core-openai-shared';
import { textToImageStore } from './text-to-image.js';
import { imageToTextStore } from './image-to-text.js';
import { imageToImageStore } from './image-to-image.js';
import { videoAnalysisStore } from './video-analysis.js';
import { chatStore } from './chat.js';

// Aggregate all stores for job listing/lookup
function getAllJobs(): AiJob[] {
    return [
        ...textToImageStore.values(),
        ...imageToTextStore.values(),
        ...imageToImageStore.values(),
        ...videoAnalysisStore.values(),
        ...chatStore.values(),
    ];
}

function findJob(id: string): AiJob | undefined {
    return textToImageStore.get(id)
        ?? imageToTextStore.get(id)
        ?? imageToImageStore.get(id)
        ?? videoAnalysisStore.get(id)
        ?? chatStore.get(id);
}

export function registerJobRoutes(app: FastifyInstance) {
    // GET / — List all jobs
    app.get('/', async () => {
        const items = getAllJobs();
        return { items, total: items.length };
    });

    // GET /:id — Get job by ID
    app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const job = findJob(req.params.id);
        if (!job) return reply.status(404).send({ error: 'Job not found' });
        return job;
    });
}

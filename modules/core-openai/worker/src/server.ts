import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connect, JSONCodec } from 'nats';
import { MODULE_NAME, NATS_SUBJECTS } from '@surdej/module-core-openai-shared';
import { registerTextToImageRoutes } from './routes/text-to-image.js';
import { registerImageToTextRoutes } from './routes/image-to-text.js';
import { registerImageToImageRoutes } from './routes/image-to-image.js';
import { registerVideoAnalysisRoutes } from './routes/video-analysis.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerBenchmarkRoutes } from './routes/benchmark.js';
import { registerPlaygroundRoutes } from './routes/playground.js';
import { registerTokenCountRoutes } from './routes/count-tokens.js';
import { registerSpeechToTextRoutes } from './routes/speech-to-text.js';
import { registerTextToSpeechRoutes } from './routes/text-to-speech.js';
import { registerEmbeddingsRoutes } from './routes/embeddings.js';
import { registerModerationRoutes } from './routes/moderation.js';
import { registerModelCatalogRoutes } from './routes/model-catalog.js';

const PORT = parseInt(process.env.MODULE_PORT ?? '7009', 10);
const HOST = process.env.MODULE_HOST ?? '0.0.0.0';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const MODULE_ID = process.env.MODULE_ID ?? crypto.randomUUID();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// Register route groups
registerTextToImageRoutes(app);
registerImageToTextRoutes(app);
registerImageToImageRoutes(app);
registerVideoAnalysisRoutes(app);
registerChatRoutes(app);
registerBenchmarkRoutes(app);
registerPlaygroundRoutes(app);
registerTokenCountRoutes(app);
registerSpeechToTextRoutes(app);
registerTextToSpeechRoutes(app);
registerEmbeddingsRoutes(app);
registerModerationRoutes(app);
registerModelCatalogRoutes(app);
registerJobRoutes(app);

// ─── Health check ───
app.get('/health', async () => ({
    status: 'ok',
    module: MODULE_NAME,
    timestamp: new Date().toISOString(),
}));

// ─── NATS Self-Registration ───
const nc = await connect({ servers: NATS_URL });
const codec = JSONCodec();

const registration = {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    version: '0.1.0',
    baseUrl: `http://localhost:${PORT}`,
    routes: [
        'GET /',
        'GET /:id',
        'GET /health',
        'GET /models',
        'GET /models/:modelId',
        'POST /text-to-image',
        'POST /image-to-text',
        'POST /image-to-image',
        'POST /video-analysis',
        'POST /chat',
        'POST /benchmark',
        'POST /playground',
        'POST /count-tokens',
        'POST /speech-to-text',
        'POST /text-to-speech',
        'POST /embeddings',
        'POST /moderation',
    ],
    timestamp: new Date().toISOString(),
};

nc.publish(NATS_SUBJECTS.register, codec.encode(registration));

const heartbeat = setInterval(() => {
    nc.publish(NATS_SUBJECTS.heartbeat, codec.encode({
        moduleName: MODULE_NAME,
        timestamp: new Date().toISOString(),
    }));
}, 30_000);

// ─── Graceful Shutdown ───
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
        clearInterval(heartbeat);
        nc.publish(NATS_SUBJECTS.deregister, codec.encode({ moduleName: MODULE_NAME }));
        await nc.drain();
        await app.close();
    });
}

await app.listen({ port: PORT, host: HOST });
app.log.info(`Module ${MODULE_NAME} running on http://${HOST}:${PORT}`);

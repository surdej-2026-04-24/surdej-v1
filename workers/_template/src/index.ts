/**
 * Worker Template — Reference implementation
 *
 * Copy this entire _template/ directory when creating a new worker.
 * Rename and customize as needed.
 */

// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import { WorkerBase } from './worker-base.js';

class TemplateWorker extends WorkerBase {
    constructor() {
        super({
            type: 'template',
            version: '0.1.0',
            capabilities: ['example'],
            maxConcurrency: 5,
        });

        // Register job handlers
        this.handle('echo', async (job) => {
            console.log(`[Template] Echo job: ${JSON.stringify(job.payload)}`);
            return { echoed: job.payload };
        });
    }
}

// Start
const worker = new TemplateWorker();
worker.start().catch((err) => {
    console.error('Worker failed to start:', err);
    process.exit(1);
});

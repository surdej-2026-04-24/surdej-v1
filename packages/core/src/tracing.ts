/**
 * OpenTelemetry Bootstrap — Must be imported BEFORE all other code.
 *
 * Initializes the OTel SDK with auto-instrumentation for:
 *   - HTTP (incoming/outgoing requests)
 *   - Fastify (route-level spans)
 *   - Pino (injects trace_id/span_id into log lines)
 *   - Logs (exports to OTel Collector → Loki)
 *
 * Configuration via environment variables:
 *   OTEL_SERVICE_NAME           — e.g. "surdej-api", "document-worker"
 *   OTEL_EXPORTER_OTLP_ENDPOINT — e.g. "http://otel-collector:4318"
 *
 * If OTEL_EXPORTER_OTLP_ENDPOINT is not set, tracing is disabled (no-op).
 *
 * @module tracing
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'surdej-unknown';

let sdk: NodeSDK | undefined;

if (endpoint) {
    // Enable OTel diagnostic logging in development
    if (process.env['NODE_ENV'] === 'development') {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
    }

    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env['npm_package_version'] ?? '0.0.0',
    });

    sdk = new NodeSDK({
        resource,
        traceExporter: new OTLPTraceExporter({
            url: `${endpoint}/v1/traces`,
        }),
        metricReaders: [new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
                url: `${endpoint}/v1/metrics`,
            }),
            exportIntervalMillis: 30_000,
        })],
        logRecordProcessors: [new BatchLogRecordProcessor(
            new OTLPLogExporter({
                url: `${endpoint}/v1/logs`,
            }),
        )],
        instrumentations: [
            getNodeAutoInstrumentations({
                // Disable fs instrumentation — too noisy
                '@opentelemetry/instrumentation-fs': { enabled: false },
                // Disable dns — not useful for internal services
                '@opentelemetry/instrumentation-dns': { enabled: false },
                // Enable Pino log correlation (injects trace_id + exports logs)
                '@opentelemetry/instrumentation-pino': { enabled: true },
                // Enable HTTP client/server
                '@opentelemetry/instrumentation-http': {
                    enabled: true,
                    ignoreIncomingRequestHook: (req: { url?: string }) => {
                        // Exclude health/metrics endpoints from traces
                        const url = req.url ?? '';
                        return url.includes('/health') || url.includes('/metrics');
                    },
                },
            } as Record<string, unknown>),
        ],
    });

    sdk.start();
    console.log(`[OTel] Tracing + logging enabled for ${serviceName} → ${endpoint}`);

    // Graceful shutdown
    const shutdownOtel = async () => {
        try {
            await sdk?.shutdown();
            console.log('[OTel] SDK shut down');
        } catch (err) {
            console.error('[OTel] Shutdown error:', err);
        }
    };

    process.on('SIGTERM', shutdownOtel);
    process.on('SIGINT', shutdownOtel);
} else {
    console.log(`[OTel] Tracing disabled (no OTEL_EXPORTER_OTLP_ENDPOINT set)`);
}

export { sdk as otelSdk };


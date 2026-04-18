/**
 * NATS Trace Propagation — Injects/extracts W3C Trace Context via NATS message headers.
 *
 * When publishing a NATS message, call `injectTraceHeaders(headers)` to add
 * the current span's trace context to the NATS headers.
 *
 * When consuming a NATS message, call `extractTraceContext(headers)` to get
 * a Context object that can be used to continue the trace.
 *
 * @module nats-tracing
 */

import { context, propagation, trace, SpanKind, type Context, type Span } from '@opentelemetry/api';
import { headers as natsHeaders, type MsgHdrs } from 'nats';

/**
 * Inject current trace context into NATS message headers.
 * Returns new or existing headers with traceparent/tracestate set.
 */
export function injectTraceHeaders(existingHeaders?: MsgHdrs): MsgHdrs {
    const hdrs = existingHeaders ?? natsHeaders();
    const carrier: Record<string, string> = {};

    propagation.inject(context.active(), carrier);

    for (const [key, value] of Object.entries(carrier)) {
        hdrs.set(key, value);
    }

    return hdrs;
}

/**
 * Extract trace context from incoming NATS message headers.
 * Returns a Context that can be used with `context.with()` to continue the trace.
 */
export function extractTraceContext(hdrs?: MsgHdrs): Context {
    if (!hdrs) return context.active();

    const carrier: Record<string, string> = {};
    for (const key of hdrs.keys()) {
        const values = hdrs.values(key);
        if (values && values.length > 0) {
            carrier[key] = values[0]!;
        }
    }

    return propagation.extract(context.active(), carrier);
}

/**
 * Start a new span for NATS message processing, linked to the parent trace
 * from message headers.
 *
 * Usage:
 *   const { span, ctx } = startNatsSpan('job.document.extract', msg.headers);
 *   try {
 *       await context.with(ctx, () => handler(job));
 *       span.end();
 *   } catch (err) {
 *       span.recordException(err);
 *       span.end();
 *       throw err;
 *   }
 */
export function startNatsSpan(
    subject: string,
    hdrs?: MsgHdrs,
    attributes?: Record<string, string | number>,
): { span: Span; ctx: Context } {
    const parentCtx = extractTraceContext(hdrs);
    const tracer = trace.getTracer('surdej-nats');

    const span = tracer.startSpan(
        `NATS ${subject}`,
        {
            kind: SpanKind.CONSUMER,
            attributes: {
                'messaging.system': 'nats',
                'messaging.destination': subject,
                'messaging.operation': 'process',
                ...attributes,
            },
        },
        parentCtx,
    );

    const ctx = trace.setSpan(parentCtx, span);
    return { span, ctx };
}

/**
 * Start a new span for NATS message publishing.
 */
export function startNatsPublishSpan(
    subject: string,
    attributes?: Record<string, string | number>,
): { span: Span; ctx: Context; headers: MsgHdrs } {
    const tracer = trace.getTracer('surdej-nats');

    const span = tracer.startSpan(subject, {
        kind: SpanKind.PRODUCER,
        attributes: {
            'messaging.system': 'nats',
            'messaging.destination': subject,
            'messaging.operation': 'publish',
            ...attributes,
        },
    });

    const ctx = trace.setSpan(context.active(), span);
    const hdrs = natsHeaders();

    // Inject trace context into headers within the new span's context
    const carrier: Record<string, string> = {};
    propagation.inject(ctx, carrier);
    for (const [key, value] of Object.entries(carrier)) {
        hdrs.set(key, value);
    }

    return { span, ctx, headers: hdrs };
}

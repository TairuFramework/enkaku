import { type Context, context, ROOT_CONTEXT, TraceFlags, trace } from '@opentelemetry/api'

import { ZERO_TRACE_ID } from './semantic.js'

/**
 * Inject the active span's trace context into a token header.
 * Adds `tid` (trace ID) and `sid` (span ID) fields.
 * Returns the header unchanged if no active span exists.
 */
export function injectTraceContext<T extends Record<string, unknown>>(header: T): T {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return header
  }
  const ctx = span.spanContext()
  if (ctx.traceId === ZERO_TRACE_ID) {
    return header
  }
  return { ...header, tid: ctx.traceId, sid: ctx.spanId }
}

/**
 * Extract trace context from a token header and return an OTel Context
 * with a remote SpanContext. Returns undefined if no trace fields are present.
 */
export function extractTraceContext(header: Record<string, unknown>): Context | undefined {
  const tid = header.tid
  const sid = header.sid
  if (typeof tid !== 'string' || typeof sid !== 'string') {
    return undefined
  }
  const remoteContext = trace.setSpanContext(ROOT_CONTEXT, {
    traceId: tid,
    spanId: sid,
    isRemote: true,
    traceFlags: TraceFlags.SAMPLED,
  })
  return remoteContext
}

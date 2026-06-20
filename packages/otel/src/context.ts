import {
  type Context,
  context,
  createTraceState,
  ROOT_CONTEXT,
  type Span,
  type SpanContext,
  TraceFlags,
  trace,
} from '@opentelemetry/api'

import { ZERO_TRACE_ID } from './semantic.js'
import { parseTraceparent } from './traceparent.js'
import { formatTracestate, parseTracestate } from './tracestate.js'

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

/**
 * Build an OTel Context from a request's W3C trace headers in `_meta`. Parses
 * `meta.traceparent` (and optional `meta.tracestate`) into a remote SpanContext.
 * Returns undefined when no valid `traceparent` is present, so callers pay
 * nothing when tracing is off. Pairs with `withActiveContext` for activation.
 */
export function extractW3CTraceContext(meta: Record<string, unknown>): Context | undefined {
  const traceparent = meta.traceparent
  if (typeof traceparent !== 'string') {
    return undefined
  }
  const parsed = parseTraceparent(traceparent)
  if (parsed == null) {
    return undefined
  }
  const spanContext: SpanContext = {
    traceId: parsed.traceID,
    spanId: parsed.spanID,
    traceFlags: parsed.traceFlags,
    isRemote: true,
  }
  if (typeof meta.tracestate === 'string') {
    const formatted = formatTracestate(parseTracestate(meta.tracestate))
    if (formatted !== '') {
      spanContext.traceState = createTraceState(formatted)
    }
  }
  return trace.setSpanContext(ROOT_CONTEXT, spanContext)
}

export function withActiveContext<T>(parentContext: Context | undefined, fn: () => T): T {
  const ctx = parentContext ?? context.active()
  return context.with(ctx, fn)
}

export function setSpanOnContext(parentContext: Context | undefined, span: Span): Context {
  const ctx = parentContext ?? context.active()
  return trace.setSpan(ctx, span)
}

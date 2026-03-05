import type { Context, SpanOptions, Tracer } from '@opentelemetry/api'
import { context, type Span, SpanStatusCode, trace } from '@opentelemetry/api'

import { ZERO_TRACE_ID } from './semantic.js'

const ENKAKU_VERSION = '0.1.0'

export function createTracer(name: string): Tracer {
  return trace.getTracer(`enkaku.${name}`, ENKAKU_VERSION)
}

export type TraceContext = {
  traceID: string
  spanID: string
  traceFlags: number
}

export function getActiveSpan(): Span | undefined {
  return trace.getSpan(context.active()) ?? undefined
}

export function getActiveTraceContext(): TraceContext | undefined {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return undefined
  }
  const ctx = span.spanContext()
  // Check for valid (non-zero) trace ID — no-op spans have all-zero IDs
  if (ctx.traceId === ZERO_TRACE_ID) {
    return undefined
  }
  return {
    traceID: ctx.traceId,
    spanID: ctx.spanId,
    traceFlags: ctx.traceFlags,
  }
}

export function withSyncSpan<T>(
  tracer: Tracer,
  name: string,
  options: SpanOptions,
  fn: (span: Span) => T,
  parentContext?: Context,
): T {
  const ctx = parentContext ?? context.active()
  const span = tracer.startSpan(name, options, ctx)
  const spanCtx = trace.setSpan(ctx, span)
  try {
    const result = context.with(spanCtx, () => fn(span))
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    span.recordException(error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    span.end()
  }
}

export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  options: SpanOptions,
  fn: (span: Span) => Promise<T>,
  parentContext?: Context,
): Promise<T> {
  const ctx = parentContext ?? context.active()
  return tracer.startActiveSpan(name, options, ctx, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  })
}

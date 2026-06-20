import { trace } from '@opentelemetry/api'
import { describe, expect, test } from 'vitest'

import {
  extractTraceContext,
  extractW3CTraceContext,
  injectTraceContext,
  setSpanOnContext,
  withActiveContext,
} from '../src/context.js'
import { createTracer } from '../src/tracers.js'

describe('injectTraceContext', () => {
  test('returns header unchanged when no active span', () => {
    const header = { typ: 'JWT', alg: 'none' as const }
    const result = injectTraceContext(header)
    expect(result).toEqual(header)
    expect(result).not.toHaveProperty('tid')
    expect(result).not.toHaveProperty('sid')
  })

  test('preserves existing header properties', () => {
    const header = { typ: 'JWT', alg: 'none' as const, custom: 'value' }
    const result = injectTraceContext(header)
    expect(result.custom).toBe('value')
  })
})

describe('extractTraceContext', () => {
  test('returns undefined when header has no trace fields', () => {
    const header = { typ: 'JWT', alg: 'none' }
    expect(extractTraceContext(header)).toBeUndefined()
  })

  test('returns undefined when tid is missing', () => {
    const header = { typ: 'JWT', alg: 'none', sid: '1234567890abcdef' }
    expect(extractTraceContext(header)).toBeUndefined()
  })

  test('returns undefined when sid is missing', () => {
    const header = { typ: 'JWT', alg: 'none', tid: '0af7651916cd43dd8448eb211c80319c' }
    expect(extractTraceContext(header)).toBeUndefined()
  })

  test('returns context when both tid and sid are present', () => {
    const header = {
      typ: 'JWT',
      alg: 'none',
      tid: '0af7651916cd43dd8448eb211c80319c',
      sid: '00f067aa0ba902b7',
    }
    const result = extractTraceContext(header)
    expect(result).toBeDefined()

    // Verify the span context extracted from the returned OTel Context
    const otelContext = result as NonNullable<typeof result>
    const span = trace.getSpan(otelContext)
    expect(span).toBeDefined()
    const spanCtx = (span as NonNullable<typeof span>).spanContext()
    expect(spanCtx.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
    expect(spanCtx.spanId).toBe('00f067aa0ba902b7')
    expect(spanCtx.isRemote).toBe(true)
  })
})

describe('withActiveContext', () => {
  test('executes function and returns its result', () => {
    const result = withActiveContext(undefined, () => 42)
    expect(result).toBe(42)
  })
})

describe('setSpanOnContext', () => {
  test('returns a Context object', () => {
    const tracer = createTracer('test')
    const span = tracer.startSpan('test')
    const ctx = setSpanOnContext(undefined, span)
    expect(ctx).toBeDefined()
    span.end()
  })
})

describe('extractW3CTraceContext', () => {
  const traceparent = '00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01'

  test('returns undefined when traceparent is absent', () => {
    expect(extractW3CTraceContext({})).toBeUndefined()
  })

  test('returns undefined when traceparent is not a string', () => {
    expect(extractW3CTraceContext({ traceparent: 123 })).toBeUndefined()
  })

  test('returns undefined for a malformed traceparent', () => {
    expect(extractW3CTraceContext({ traceparent: 'garbage' })).toBeUndefined()
  })

  test('builds a remote SpanContext from a valid traceparent', () => {
    const ctx = extractW3CTraceContext({ traceparent })
    expect(ctx).toBeDefined()
    const span = trace.getSpan(ctx as NonNullable<typeof ctx>)
    const spanCtx = (span as NonNullable<typeof span>).spanContext()
    expect(spanCtx.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
    expect(spanCtx.spanId).toBe('00f067aa0ba902b7')
    expect(spanCtx.traceFlags).toBe(1)
    expect(spanCtx.isRemote).toBe(true)
  })

  test('uses the parsed trace flags rather than a hardcoded value', () => {
    const ctx = extractW3CTraceContext({
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-00',
    })
    const span = trace.getSpan(ctx as NonNullable<typeof ctx>)
    expect((span as NonNullable<typeof span>).spanContext().traceFlags).toBe(0)
  })

  test('attaches tracestate when present', () => {
    const ctx = extractW3CTraceContext({ traceparent, tracestate: 'vendor=value' })
    const span = trace.getSpan(ctx as NonNullable<typeof ctx>)
    expect((span as NonNullable<typeof span>).spanContext().traceState?.get('vendor')).toBe('value')
  })
})

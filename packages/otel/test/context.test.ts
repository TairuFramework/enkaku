import { context, ROOT_CONTEXT, TraceFlags, trace } from '@opentelemetry/api'
import { describe, expect, test } from 'vitest'

import { extractTraceContext, injectTraceContext } from '../src/context.js'

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
    const span = trace.getSpan(result!)
    expect(span).toBeDefined()
    const spanCtx = span!.spanContext()
    expect(spanCtx.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
    expect(spanCtx.spanId).toBe('00f067aa0ba902b7')
    expect(spanCtx.isRemote).toBe(true)
  })
})

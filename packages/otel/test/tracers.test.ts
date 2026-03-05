import { describe, expect, test } from 'vitest'

import {
  createTracer,
  getActiveSpan,
  getActiveTraceContext,
  withSpan,
  withSyncSpan,
} from '../src/tracers.js'

describe('createTracer', () => {
  test('returns a Tracer from the global TracerProvider', () => {
    const tracer = createTracer('test-module')
    expect(tracer).toBeDefined()
    // Without an SDK registered, this returns a no-op tracer
    expect(typeof tracer.startSpan).toBe('function')
    expect(typeof tracer.startActiveSpan).toBe('function')
  })
})

describe('getActiveTraceContext', () => {
  test('returns undefined when no span is active', () => {
    expect(getActiveTraceContext()).toBeUndefined()
  })
})

describe('withSpan', () => {
  test('executes the function and returns its result', async () => {
    const tracer = createTracer('test')
    const result = await withSpan(tracer, 'test-span', {}, async () => {
      return 42
    })
    expect(result).toBe(42)
  })

  test('propagates errors from the function', async () => {
    const tracer = createTracer('test')
    await expect(
      withSpan(tracer, 'test-span', {}, async () => {
        throw new Error('test error')
      }),
    ).rejects.toThrow('test error')
  })

  test('passes the span to the function', async () => {
    const tracer = createTracer('test')
    await withSpan(tracer, 'test-span', {}, async (span) => {
      expect(span).toBeDefined()
      expect(typeof span.setAttribute).toBe('function')
      expect(typeof span.setStatus).toBe('function')
      expect(typeof span.end).toBe('function')
    })
  })
})

describe('getActiveSpan', () => {
  test('returns undefined when no span is active', () => {
    expect(getActiveSpan()).toBeUndefined()
  })
})

describe('withSyncSpan', () => {
  test('executes the function and returns its result', () => {
    const tracer = createTracer('test')
    const result = withSyncSpan(tracer, 'test-span', {}, () => 42)
    expect(result).toBe(42)
  })

  test('propagates errors from the function', () => {
    const tracer = createTracer('test')
    expect(() =>
      withSyncSpan(tracer, 'test-span', {}, () => {
        throw new Error('test error')
      }),
    ).toThrow('test error')
  })

  test('passes the span to the function', () => {
    const tracer = createTracer('test')
    withSyncSpan(tracer, 'test-span', {}, (span) => {
      expect(span).toBeDefined()
      expect(typeof span.setAttribute).toBe('function')
    })
  })
})

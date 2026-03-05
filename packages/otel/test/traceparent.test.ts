import { describe, expect, test } from 'vitest'

import { formatTraceparent, parseTraceparent } from '../src/traceparent.js'

describe('formatTraceparent', () => {
  test('formats a traceparent header', () => {
    const result = formatTraceparent('0af7651916cd43dd8448eb211c80319c', '00f067aa0ba902b7', 1)
    expect(result).toBe('00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01')
  })

  test('formats with zero flags', () => {
    const result = formatTraceparent('0af7651916cd43dd8448eb211c80319c', '00f067aa0ba902b7', 0)
    expect(result).toBe('00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-00')
  })
})

describe('parseTraceparent', () => {
  test('parses a valid traceparent header', () => {
    const result = parseTraceparent('00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01')
    expect(result).toEqual({
      traceID: '0af7651916cd43dd8448eb211c80319c',
      spanID: '00f067aa0ba902b7',
      traceFlags: 1,
    })
  })

  test('returns undefined for invalid format', () => {
    expect(parseTraceparent('invalid')).toBeUndefined()
    expect(parseTraceparent('')).toBeUndefined()
    expect(parseTraceparent('00-short-00f067aa0ba902b7-01')).toBeUndefined()
  })

  test('returns undefined for unsupported version', () => {
    expect(
      parseTraceparent('ff-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01'),
    ).toBeUndefined()
  })
})

import type { Logger } from '@enkaku/log'
import { describe, expect, test } from 'vitest'

import { traceLogger } from '../src/logger.js'

describe('traceLogger', () => {
  test('returns the same logger when no span is active', () => {
    const mockLogger = { with: () => mockLogger } as unknown as Logger
    const result = traceLogger(mockLogger)
    expect(result).toBe(mockLogger)
  })
})

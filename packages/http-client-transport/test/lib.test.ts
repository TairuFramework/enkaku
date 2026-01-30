import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

import { ResponseError, createTransportStream } from '../src/index.js'

describe('ResponseError', () => {
  test('stores the response object', () => {
    const response = new Response('Not Found', { status: 404, statusText: 'Not Found' })
    const error = new ResponseError(response)
    expect(error.response).toBe(response)
    expect(error.message).toBe('Transport request failed with status 404 (Not Found)')
  })

  test('is an instance of Error', () => {
    const response = new Response('', { status: 500, statusText: 'Internal Server Error' })
    const error = new ResponseError(response)
    expect(error).toBeInstanceOf(Error)
  })
})

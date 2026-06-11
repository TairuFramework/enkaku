import { describe, expect, test } from 'vitest'

import { type ErrorCode, ErrorCodes } from '../src/index.js'

describe('ErrorCodes', () => {
  test('exposes the stable EK code registry', () => {
    expect(ErrorCodes).toEqual({
      HANDLER_ERROR: 'EK01',
      ACCESS_DENIED: 'EK02',
      CONTROLLER_LIMIT: 'EK03',
      HANDLER_LIMIT: 'EK04',
      TIMEOUT: 'EK05',
      MESSAGE_TOO_LARGE: 'EK06',
      ENCRYPTION_REQUIRED: 'EK07',
      INVALID_MESSAGE: 'EK08',
    })
  })

  test('ErrorCode union covers registry values and stays a plain string subtype', () => {
    const code: ErrorCode = ErrorCodes.INVALID_MESSAGE
    expect(code).toBe('EK08')
    expect(code === 'EK08').toBe(true)
  })
})

import { describe, expect, test } from 'vitest'

import { PACKAGE_NAME } from '../src/index.js'

describe('@enkaku/broadcast', () => {
  test('package barrel is importable', () => {
    expect(PACKAGE_NAME).toBe('@enkaku/broadcast')
  })
})

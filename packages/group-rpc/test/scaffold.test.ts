import { describe, expect, test } from 'vitest'

import { PACKAGE_NAME } from '../src/index.js'

describe('@enkaku/group-rpc scaffold', () => {
  test('exposes the package name', () => {
    expect(PACKAGE_NAME).toBe('@enkaku/group-rpc')
  })
})

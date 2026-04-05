import { describe, expect, test } from 'vitest'

import { sanitizeRatchetTree } from '../src/codec.js'

describe('sanitizeRatchetTree', () => {
  test('converts null entries to undefined', () => {
    const tree = [{ nodeType: 1, leaf: {} }, null, { nodeType: 2, parent: {} }] as Array<unknown>
    const result = sanitizeRatchetTree(tree)
    expect(result).toEqual([{ nodeType: 1, leaf: {} }, undefined, { nodeType: 2, parent: {} }])
    expect(result[1]).toBeUndefined()
  })

  test('preserves undefined entries', () => {
    const tree = [{ nodeType: 1, leaf: {} }, undefined] as Array<unknown>
    const result = sanitizeRatchetTree(tree)
    expect(result).toEqual([{ nodeType: 1, leaf: {} }, undefined])
    expect(result[1]).toBeUndefined()
  })

  test('handles empty tree', () => {
    const result = sanitizeRatchetTree([])
    expect(result).toEqual([])
  })

  test('handles tree with no blank nodes', () => {
    const nodes = [
      { nodeType: 1, leaf: {} },
      { nodeType: 2, parent: {} },
    ] as Array<unknown>
    const result = sanitizeRatchetTree(nodes)
    expect(result).toEqual(nodes)
  })
})

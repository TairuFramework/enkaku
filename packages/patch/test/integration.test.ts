import { describe, expect, test } from 'vitest'

import { applyPatches, createPatches } from '../src/index.js'

describe('Integration tests - createPatches and applyPatches', () => {
  test('should round-trip simple objects', () => {
    const from = { foo: 1, bar: 'test' }
    const to = { foo: 2, baz: 'new' }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should round-trip nested objects', () => {
    const from = {
      user: {
        name: 'John',
        settings: { theme: 'dark', lang: 'en' },
      },
    }
    const to = {
      user: {
        name: 'Jane',
        settings: { theme: 'light', lang: 'en' },
      },
    }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should round-trip arrays', () => {
    const from = { items: [1, 2, 3, 4] }
    const to = { items: [1, 5, 6] }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should round-trip nested arrays with objects', () => {
    const from = {
      users: [
        { id: 1, name: 'John', tags: ['admin'] },
        { id: 2, name: 'Jane', tags: ['user'] },
      ],
    }
    const to = {
      users: [
        { id: 1, name: 'John Doe', tags: ['admin', 'moderator'] },
        { id: 3, name: 'Bob', tags: ['user'] },
      ],
    }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should handle type changes in round-trip', () => {
    const from = { data: 'string' }
    const to = { data: 42 }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should handle empty patches (no changes)', () => {
    const from = { foo: 1, bar: { baz: 2 } }
    const to = { foo: 1, bar: { baz: 2 } }

    const patches = createPatches(to, from)
    expect(patches).toEqual([])

    const result = structuredClone(from)
    applyPatches(result, patches)
    expect(result).toEqual(to)
  })

  test('should create empty patches after round-trip', () => {
    const from = { foo: 1, bar: { baz: 'test' }, items: [1, 2, 3] }
    const to = { foo: 2, qux: 'new', items: [1, 3, 4] }

    // First round-trip
    const patches1 = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches1, false)
    expect(result).toEqual(to)

    // Second patch creation should be empty since result equals to
    const patches2 = createPatches(to, result)
    expect(patches2).toEqual([])
  })

  test('should handle complex real-world scenario', () => {
    const from = {
      version: 1,
      metadata: {
        author: 'John',
        created: '2023-01-01',
        tags: ['draft', 'unpublished'],
      },
      content: {
        title: 'Old Title',
        body: 'Old body text',
        sections: [
          { heading: 'Intro', text: 'Introduction text' },
          { heading: 'Body', text: 'Body text' },
        ],
      },
    }

    const to = {
      version: 2,
      metadata: {
        author: 'Jane',
        created: '2023-01-01',
        modified: '2023-02-01',
        tags: ['published'],
      },
      content: {
        title: 'New Title',
        body: 'Updated body text',
        sections: [
          { heading: 'Intro', text: 'Updated introduction text' },
          { heading: 'Conclusion', text: 'Conclusion text' },
        ],
      },
    }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should handle multiple sequential transformations', () => {
    const state1 = { count: 0, items: [] }
    const state2 = { count: 1, items: ['a'] }
    const state3 = { count: 2, items: ['a', 'b'] }
    const state4 = { count: 2, items: ['b', 'c'] }

    // Transform state1 -> state2
    let patches = createPatches(state2, state1)
    const current = structuredClone(state1)
    applyPatches(current, patches)
    expect(current).toEqual(state2)

    // Transform state2 -> state3
    patches = createPatches(state3, current)
    applyPatches(current, patches)
    expect(current).toEqual(state3)

    // Transform state3 -> state4
    patches = createPatches(state4, current)
    applyPatches(current, patches)
    expect(current).toEqual(state4)
  })

  test('should handle null values in round-trip', () => {
    const from = { a: null, b: 1, c: 'test' }
    const to = { a: 1, b: null, c: null }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should handle boolean values in round-trip', () => {
    const from = { active: true, verified: false, pending: true }
    const to = { active: false, verified: true, pending: true }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should handle empty arrays and objects', () => {
    const from = { arr: [1, 2, 3], obj: { a: 1, b: 2 } }
    const to = { arr: [], obj: {} }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  test('should handle deeply nested structures', () => {
    const from = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'old',
              items: [1, 2],
            },
          },
        },
      },
    }

    const to = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'new',
              items: [1, 2, 3],
            },
          },
        },
      },
    }

    const patches = createPatches(to, from)
    const result = structuredClone(from)
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })
})

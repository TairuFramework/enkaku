import { applyPatches, createPatches } from '../src/index.js'

describe('createPatches()', () => {
  it('should create empty patches for identical objects', () => {
    const from = { foo: 1, bar: 'test' }
    const to = { foo: 1, bar: 'test' }
    const patches = createPatches(to, from)
    expect(patches).toEqual([])
  })

  it('should create add operations for new properties', () => {
    const from = { foo: 1 }
    const to = { foo: 1, bar: 2, baz: 'test' }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'add', path: '/bar', value: 2 },
      { op: 'add', path: '/baz', value: 'test' },
    ])
  })

  it('should create remove operations for deleted properties', () => {
    const from = { foo: 1, bar: 2, baz: 'test' }
    const to = { foo: 1 }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'remove', path: '/bar' },
      { op: 'remove', path: '/baz' },
    ])
  })

  it('should create replace operations for changed values', () => {
    const from = { foo: 1, bar: 'old' }
    const to = { foo: 2, bar: 'new' }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/foo', value: 2 },
      { op: 'replace', path: '/bar', value: 'new' },
    ])
  })

  it('should handle nested objects', () => {
    const from = { foo: { bar: 1, baz: 'old' } }
    const to = { foo: { bar: 2, qux: 'new' } }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/foo/bar', value: 2 },
      { op: 'remove', path: '/foo/baz' },
      { op: 'add', path: '/foo/qux', value: 'new' },
    ])
  })

  it('should handle arrays', () => {
    const from = { items: [1, 2, 3] }
    const to = { items: [1, 4, 5] }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/items/1', value: 4 },
      { op: 'replace', path: '/items/2', value: 5 },
    ])
  })

  it('should handle array length changes', () => {
    const from = { items: [1, 2] }
    const to = { items: [1, 2, 3, 4] }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'add', path: '/items/2', value: 3 },
      { op: 'add', path: '/items/3', value: 4 },
    ])
  })

  it('should handle array shrinking', () => {
    const from = { items: [1, 2, 3, 4] }
    const to = { items: [1, 2] }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'remove', path: '/items/2' },
      { op: 'remove', path: '/items/2' },
    ])
  })

  it('should handle null values', () => {
    const from = { foo: 1, bar: null }
    const to = { foo: null, bar: 2 }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/foo', value: null },
      { op: 'replace', path: '/bar', value: 2 },
    ])
  })

  it('should handle nested arrays', () => {
    const from = {
      items: [
        [1, 2],
        [3, 4],
      ],
    }
    const to = {
      items: [
        [1, 5],
        [6, 4],
      ],
    }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/items/0/1', value: 5 },
      { op: 'replace', path: '/items/1/0', value: 6 },
    ])
  })

  it('should work with empty from object', () => {
    const from = {}
    const to = { foo: 1, bar: { baz: 2 } }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'add', path: '/foo', value: 1 },
      { op: 'add', path: '/bar', value: { baz: 2 } },
    ])
  })

  it('should generate patches that can be applied correctly', () => {
    const from = { foo: 1, bar: { baz: 'old' }, items: [1, 2] }
    const to = { foo: 2, qux: 'new', items: [1, 3, 4] }

    const patches = createPatches(to, from)
    const result = { ...from }
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })

  it('should handle complex nested structures', () => {
    const from = {
      user: {
        name: 'John',
        settings: {
          theme: 'dark',
          notifications: [true, false, true],
        },
      },
      metadata: {
        version: 1,
        tags: ['old'],
      },
    }

    const to = {
      user: {
        name: 'Jane',
        settings: {
          theme: 'light',
          notifications: [false, true],
        },
      },
      metadata: {
        version: 2,
        tags: ['new', 'updated'],
      },
    }

    const patches = createPatches(to, from)
    const result = { ...from }
    applyPatches(result, patches)

    expect(result).toEqual(to)
  })
})

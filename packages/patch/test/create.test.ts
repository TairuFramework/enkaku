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

  it('should handle empty arrays', () => {
    const from = { items: [1, 2, 3] }
    const to = { items: [] }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'remove', path: '/items/0' },
      { op: 'remove', path: '/items/0' },
      { op: 'remove', path: '/items/0' },
    ])
  })

  it('should handle arrays with objects', () => {
    const from = { users: [{ id: 1, name: 'John' }] }
    const to = { users: [{ id: 1, name: 'Jane' }] }
    const patches = createPatches(to, from)
    expect(patches).toEqual([{ op: 'replace', path: '/users/0/name', value: 'Jane' }])
  })

  it('should handle adding objects to arrays', () => {
    const from = { users: [{ id: 1, name: 'John' }] }
    const to = {
      users: [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ],
    }
    const patches = createPatches(to, from)
    expect(patches).toEqual([{ op: 'add', path: '/users/1', value: { id: 2, name: 'Jane' } }])
  })

  it('should handle boolean values', () => {
    const from = { active: true, verified: false }
    const to = { active: false, verified: true }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/active', value: false },
      { op: 'replace', path: '/verified', value: true },
    ])
  })

  it('should handle type change from object to array', () => {
    const from = { data: { foo: 'bar' } }
    const to = { data: [1, 2, 3] }
    const patches = createPatches(to, from)
    // The function treats arrays and objects differently, so it generates
    // individual operations instead of a single replace
    expect(patches).toEqual([
      { op: 'remove', path: '/data/foo' },
      { op: 'add', path: '/data/0', value: 1 },
      { op: 'add', path: '/data/1', value: 2 },
      { op: 'add', path: '/data/2', value: 3 },
    ])
  })

  it('should handle type change from array to object', () => {
    const from = { data: [1, 2, 3] }
    const to = { data: { foo: 'bar' } }
    const patches = createPatches(to, from)
    // The function treats arrays and objects differently, so it generates
    // individual operations instead of a single replace
    expect(patches).toEqual([
      { op: 'remove', path: '/data/0' },
      { op: 'remove', path: '/data/1' },
      { op: 'remove', path: '/data/2' },
      { op: 'add', path: '/data/foo', value: 'bar' },
    ])
  })

  it('should handle type change from array to primitive', () => {
    const from = { data: [1, 2, 3] }
    const to = { data: 'string' }
    const patches = createPatches(to, from)
    expect(patches).toEqual([{ op: 'replace', path: '/data', value: 'string' }])
  })

  it('should handle type change from primitive to array', () => {
    const from = { data: 'string' }
    const to = { data: [1, 2, 3] }
    const patches = createPatches(to, from)
    expect(patches).toEqual([{ op: 'replace', path: '/data', value: [1, 2, 3] }])
  })

  it('should use empty object as default for from parameter', () => {
    const to = { foo: 1, bar: { baz: 2 } }
    const patches = createPatches(to)
    expect(patches).toEqual([
      { op: 'add', path: '/foo', value: 1 },
      { op: 'add', path: '/bar', value: { baz: 2 } },
    ])
  })

  it('should handle arrays with null values', () => {
    const from = { items: [1, null, 3] }
    const to = { items: [null, 2, null] }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/items/0', value: null },
      { op: 'replace', path: '/items/1', value: 2 },
      { op: 'replace', path: '/items/2', value: null },
    ])
  })

  it('should handle deeply nested arrays with objects', () => {
    const from = {
      data: [{ users: [{ name: 'John' }] }, { users: [{ name: 'Jane' }] }],
    }
    const to = {
      data: [{ users: [{ name: 'John', age: 30 }] }, { users: [{ name: 'Jane' }] }],
    }
    const patches = createPatches(to, from)
    expect(patches).toEqual([{ op: 'add', path: '/data/0/users/0/age', value: 30 }])
  })

  it('should handle number values including zero', () => {
    const from = { a: 0, b: 1, c: -1 }
    const to = { a: 1, b: 0, c: 0 }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/a', value: 1 },
      { op: 'replace', path: '/b', value: 0 },
      { op: 'replace', path: '/c', value: 0 },
    ])
  })

  it('should handle empty strings', () => {
    const from = { a: '', b: 'hello' }
    const to = { a: 'world', b: '' }
    const patches = createPatches(to, from)
    expect(patches).toEqual([
      { op: 'replace', path: '/a', value: 'world' },
      { op: 'replace', path: '/b', value: '' },
    ])
  })
})

import { applyPatches, PatchError } from '../src/index.js'

describe('applyPatches()', () => {
  it('should apply add operations', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    applyPatches(data, [{ op: 'add', path: '/foo/baz', value: 2 }])
    expect(data).toEqual({ foo: { bar: 1, baz: 2 } })
  })

  describe('set operations', () => {
    it('should apply on existing path', () => {
      const data: Record<string, unknown> = { foo: { bar: 1, baz: 1 } }
      applyPatches(data, [{ op: 'set', path: '/foo/baz', value: 2 }])
      expect(data).toEqual({ foo: { bar: 1, baz: 2 } })
    })

    it('should apply on non-existent path', () => {
      const data: Record<string, unknown> = { foo: { bar: 1 } }
      applyPatches(data, [{ op: 'set', path: '/foo/baz', value: 2 }])
      expect(data).toEqual({ foo: { bar: 1, baz: 2 } })
    })

    it('should set values on arrays', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'set', path: '/items/1', value: 99 }])
      expect(data.items).toEqual([1, 99, 3])
    })
  })

  it('should apply remove operations', () => {
    const data: Record<string, unknown> = { foo: { bar: 1, baz: 2 } }
    applyPatches(data, [{ op: 'remove', path: '/foo/baz' }])
    expect(data).toEqual({ foo: { bar: 1 } })
  })

  it('should apply replace operations', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    applyPatches(data, [{ op: 'replace', path: '/foo/bar', value: 2 }])
    expect(data).toEqual({ foo: { bar: 2 } })
  })

  it('should apply copy operations', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    applyPatches(data, [{ op: 'copy', from: '/foo/bar', path: '/foo/baz' }])
    expect(data).toEqual({ foo: { bar: 1, baz: 1 } })
  })

  it('should apply move operations', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    applyPatches(data, [{ op: 'move', from: '/foo/bar', path: '/foo/baz' }])
    expect(data).toEqual({ foo: { baz: 1 } })
  })

  it('should apply multiple operations in sequence', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    applyPatches(data, [
      { op: 'add', path: '/foo/baz', value: 2 },
      { op: 'replace', path: '/foo/bar', value: 3 },
      { op: 'remove', path: '/foo/baz' },
    ])
    expect(data).toEqual({ foo: { bar: 3 } })
  })

  it('should throw on invalid operations', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    // @ts-expect-error invalid operation
    expect(() => applyPatches(data, [{ op: 'invalid', path: '/foo/bar' }])).toThrow(PatchError)
  })

  it('should throw on non-existent paths for replace/remove', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    expect(() => applyPatches(data, [{ op: 'replace', path: '/foo/baz', value: 2 }])).toThrow(
      PatchError,
    )
    expect(() => applyPatches(data, [{ op: 'remove', path: '/foo/baz' }])).toThrow(PatchError)
  })

  it('should not throw on non-existent paths for replace/remove if strict is false', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    expect(() =>
      applyPatches(data, [{ op: 'replace', path: '/foo/baz', value: 2 }], false),
    ).not.toThrow()
    expect(() => applyPatches(data, [{ op: 'remove', path: '/foo/baz' }], false)).not.toThrow()
  })

  it('should throw on existing paths for add', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    expect(() => applyPatches(data, [{ op: 'add', path: '/foo/bar', value: 2 }])).toThrow(
      PatchError,
    )
  })

  it('should not throw on existing paths for add if strict is false', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    expect(() =>
      applyPatches(data, [{ op: 'add', path: '/foo/bar', value: 2 }], false),
    ).not.toThrow()
  })

  describe('test operations', () => {
    it('should pass when values match exactly', () => {
      const data: Record<string, unknown> = { foo: { bar: 1, baz: 'test' } }
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo/bar', value: 1 }])).not.toThrow()
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/foo/baz', value: 'test' }]),
      ).not.toThrow()
    })

    it('should pass for null values', () => {
      const data: Record<string, unknown> = { foo: null }
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo', value: null }])).not.toThrow()
    })

    it('should pass for array elements', () => {
      const data: Record<string, unknown> = { items: [1, 'two', null] }
      expect(() => applyPatches(data, [{ op: 'test', path: '/items/0', value: 1 }])).not.toThrow()
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/items/1', value: 'two' }]),
      ).not.toThrow()
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/items/2', value: null }]),
      ).not.toThrow()
    })

    it('should pass for nested objects', () => {
      const data: Record<string, unknown> = { user: { name: 'John', age: 30 } }
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/user/name', value: 'John' }]),
      ).not.toThrow()
    })

    it('should fail when values do not match', () => {
      const data: Record<string, unknown> = { foo: { bar: 1 } }
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo/bar', value: 2 }])).toThrow(
        PatchError,
      )
      try {
        applyPatches(data, [{ op: 'test', path: '/foo/bar', value: 2 }])
      } catch (error) {
        expect((error as PatchError).code).toBe('TEST_FAILED')
      }
    })

    it('should fail for type mismatches', () => {
      const data: Record<string, unknown> = { foo: 1 }
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo', value: '1' }])).toThrow(
        PatchError,
      )
    })

    it('should fail for null vs undefined', () => {
      const data: Record<string, unknown> = { foo: null }
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo', value: undefined }])).toThrow(
        PatchError,
      )
    })

    it('should fail when path does not exist', () => {
      const data: Record<string, unknown> = { foo: { bar: 1 } }
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo/baz', value: 1 }])).toThrow(
        PatchError,
      )
      try {
        applyPatches(data, [{ op: 'test', path: '/foo/baz', value: 1 }])
      } catch (error) {
        expect((error as PatchError).code).toBe('PATH_NOT_FOUND')
      }
    })

    it('should handle NaN values correctly', () => {
      const data: Record<string, unknown> = { foo: Number.NaN }
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/foo', value: Number.NaN }]),
      ).not.toThrow()
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo', value: 0 }])).toThrow(PatchError)
    })

    it('should distinguish between +0 and -0', () => {
      const data: Record<string, unknown> = { foo: +0 }
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo', value: +0 }])).not.toThrow()
      expect(() => applyPatches(data, [{ op: 'test', path: '/foo', value: -0 }])).toThrow(
        PatchError,
      )
    })

    it('should abort entire patch on test failure', () => {
      const data: Record<string, unknown> = { foo: 1, bar: 2 }
      expect(() =>
        applyPatches(data, [
          { op: 'test', path: '/foo', value: 1 },
          { op: 'test', path: '/bar', value: 3 }, // This should fail
          { op: 'replace', path: '/foo', value: 99 },
        ]),
      ).toThrow(PatchError)
      // Original data should be unchanged
      expect(data.foo).toBe(1)
    })
  })

  describe('root path operations', () => {
    it('should handle root path for simple values', () => {
      const data: unknown = { original: 'value' }
      // Note: Root replacement would require modifying the reference,
      // which isn't possible with current implementation
      // This documents the current limitation
      expect(() =>
        applyPatches(data as Record<string, unknown>, [
          { op: 'test', path: '', value: { original: 'value' } },
        ]),
      ).toThrow(PatchError)
    })
  })

  describe('empty string property keys', () => {
    it('should handle empty string keys in objects', () => {
      const data: Record<string, unknown> = { '': 'empty key', foo: 'bar' }
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/', value: 'empty key' }]),
      ).not.toThrow()

      applyPatches(data, [{ op: 'replace', path: '/', value: 'new value' }])
      expect(data['']).toBe('new value')
    })

    it('should add properties with empty string keys', () => {
      const data: Record<string, unknown> = { foo: 'bar' }
      applyPatches(data, [{ op: 'add', path: '/', value: 'empty key value' }])
      expect(data['']).toBe('empty key value')
    })
  })

  describe('advanced JSON Pointer escape sequences', () => {
    it('should handle complex escape sequences', () => {
      const data: Record<string, unknown> = {
        'a/b': 'slash value',
        'c~d': 'tilde value',
        'e~f/g': 'mixed value',
        '~/~': 'multiple escapes',
      }

      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/a~1b', value: 'slash value' }]),
      ).not.toThrow()
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/c~0d', value: 'tilde value' }]),
      ).not.toThrow()
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/e~0f~1g', value: 'mixed value' }]),
      ).not.toThrow()
      expect(() =>
        applyPatches(data, [{ op: 'test', path: '/~0~1~0', value: 'multiple escapes' }]),
      ).not.toThrow()
    })

    it('should handle nested objects with special characters', () => {
      const data: Record<string, unknown> = {
        'special/chars': {
          '~tilde': 'value',
          '/slash': 'another',
        },
      }

      applyPatches(data, [{ op: 'replace', path: '/special~1chars/~0tilde', value: 'updated' }])
      expect((data['special/chars'] as Record<string, unknown>)['~tilde']).toBe('updated')
    })
  })

  describe('array operations', () => {
    it('should add elements to arrays', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'add', path: '/items/3', value: 4 }])
      expect(data.items).toEqual([1, 2, 3, 4])
    })

    it('should remove elements from arrays', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'remove', path: '/items/1' }])
      expect(data.items).toEqual([1, 3])
    })

    it('should replace elements in arrays', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'replace', path: '/items/1', value: 99 }])
      expect(data.items).toEqual([1, 99, 3])
    })

    it('should handle multiple array operations in sequence', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [
        { op: 'add', path: '/items/3', value: 4 },
        { op: 'replace', path: '/items/0', value: 10 },
        { op: 'remove', path: '/items/2' },
      ])
      expect(data.items).toEqual([10, 2, 4])
    })

    it('should handle nested arrays', () => {
      const data: Record<string, unknown> = { matrix: [[1, 2], [3, 4]] }
      applyPatches(data, [{ op: 'replace', path: '/matrix/0/1', value: 99 }])
      expect(data.matrix).toEqual([[1, 99], [3, 4]])
    })

    it('should handle arrays with objects', () => {
      const data: Record<string, unknown> = { users: [{ name: 'John' }, { name: 'Jane' }] }
      applyPatches(data, [{ op: 'replace', path: '/users/0/name', value: 'Bob' }])
      expect((data.users as Array<Record<string, unknown>>)[0].name).toBe('Bob')
    })

    it('should throw on invalid array index for add', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      expect(() => applyPatches(data, [{ op: 'add', path: '/items/10', value: 4 }])).toThrow(
        PatchError,
      )
    })

    it('should throw on negative array index', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      expect(() => applyPatches(data, [{ op: 'add', path: '/items/-1', value: 4 }])).toThrow(
        PatchError,
      )
    })
  })

  describe('copy operations edge cases', () => {
    it('should throw when source path does not exist', () => {
      const data: Record<string, unknown> = { foo: { bar: 1 } }
      expect(() =>
        applyPatches(data, [{ op: 'copy', from: '/foo/nonexistent', path: '/foo/baz' }]),
      ).toThrow(PatchError)
      try {
        applyPatches(data, [{ op: 'copy', from: '/foo/nonexistent', path: '/foo/baz' }])
      } catch (error) {
        expect((error as PatchError).code).toBe('PATH_NOT_FOUND')
      }
    })

    it('should copy nested objects', () => {
      const data: Record<string, unknown> = { original: { nested: { value: 42 } } }
      applyPatches(data, [{ op: 'copy', from: '/original/nested', path: '/copy' }])
      expect(data.copy).toEqual({ value: 42 })
    })

    it('should copy array elements', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'copy', from: '/items/1', path: '/backup' }])
      expect(data.backup).toBe(2)
    })

    it('should copy between arrays', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'copy', from: '/items/0', path: '/items/3' }])
      expect(data.items).toEqual([1, 2, 3, 1])
    })
  })

  describe('move operations edge cases', () => {
    it('should throw when source path does not exist', () => {
      const data: Record<string, unknown> = { foo: { bar: 1 } }
      expect(() =>
        applyPatches(data, [{ op: 'move', from: '/foo/nonexistent', path: '/foo/baz' }]),
      ).toThrow(PatchError)
      try {
        applyPatches(data, [{ op: 'move', from: '/foo/nonexistent', path: '/foo/baz' }])
      } catch (error) {
        expect((error as PatchError).code).toBe('PATH_NOT_FOUND')
      }
    })

    it('should move nested objects', () => {
      const data: Record<string, unknown> = { original: { nested: { value: 42 } } }
      applyPatches(data, [{ op: 'move', from: '/original/nested', path: '/moved' }])
      expect(data.moved).toEqual({ value: 42 })
      expect((data.original as Record<string, unknown>).nested).toBeUndefined()
    })

    it('should move array elements', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'move', from: '/items/1', path: '/backup' }])
      expect(data.backup).toBe(2)
      expect(data.items).toEqual([1, 3])
    })

    it('should move between arrays', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      applyPatches(data, [{ op: 'move', from: '/items/0', path: '/items/2' }])
      expect(data.items).toEqual([2, 3, 1])
    })

    it('should move properties within same object', () => {
      const data: Record<string, unknown> = { a: 1, b: 2 }
      applyPatches(data, [{ op: 'move', from: '/a', path: '/c' }])
      expect(data).toEqual({ b: 2, c: 1 })
    })
  })

  describe('error handling edge cases', () => {
    it('should throw PatchError with correct code for invalid paths', () => {
      const data: Record<string, unknown> = { foo: 1 }
      try {
        applyPatches(data, [{ op: 'replace', path: '/bar', value: 2 }])
      } catch (error) {
        expect(error).toBeInstanceOf(PatchError)
        expect((error as PatchError).code).toBe('PATH_NOT_FOUND')
        expect((error as PatchError).name).toBe('PatchError')
      }
    })

    it('should throw PatchError with correct code for path exists', () => {
      const data: Record<string, unknown> = { foo: 1 }
      try {
        applyPatches(data, [{ op: 'add', path: '/foo', value: 2 }])
      } catch (error) {
        expect(error).toBeInstanceOf(PatchError)
        expect((error as PatchError).code).toBe('PATH_EXISTS')
      }
    })

    it('should throw PatchError with correct code for invalid index', () => {
      const data: Record<string, unknown> = { items: [1, 2, 3] }
      try {
        applyPatches(data, [{ op: 'add', path: '/items/10', value: 4 }])
      } catch (error) {
        expect(error).toBeInstanceOf(PatchError)
        expect((error as PatchError).code).toBe('INVALID_INDEX')
      }
    })

    it('should throw PatchError with correct code for invalid operation', () => {
      const data: Record<string, unknown> = { foo: 1 }
      try {
        // @ts-expect-error invalid operation
        applyPatches(data, [{ op: 'unknown', path: '/foo' }])
      } catch (error) {
        expect(error).toBeInstanceOf(PatchError)
        expect((error as PatchError).code).toBe('INVALID_OPERATION')
      }
    })

    it('should handle deeply nested path errors', () => {
      const data: Record<string, unknown> = { a: { b: { c: 1 } } }
      expect(() => applyPatches(data, [{ op: 'replace', path: '/a/b/c/d', value: 2 }])).toThrow(
        PatchError,
      )
    })
  })

  describe('complex real-world scenarios', () => {
    it('should handle mix of operations on nested structures', () => {
      const data: Record<string, unknown> = {
        user: { name: 'John', age: 30 },
        items: [1, 2, 3],
      }
      applyPatches(data, [
        { op: 'replace', path: '/user/name', value: 'Jane' },
        { op: 'add', path: '/user/email', value: 'jane@example.com' },
        { op: 'remove', path: '/items/1' },
        { op: 'add', path: '/items/2', value: 4 },
      ])
      expect(data).toEqual({
        user: { name: 'Jane', age: 30, email: 'jane@example.com' },
        items: [1, 3, 4],
      })
    })

    it('should handle operations that build up structure', () => {
      const data: Record<string, unknown> = {}
      applyPatches(
        data,
        [
          { op: 'add', path: '/user', value: {} },
          { op: 'add', path: '/user/name', value: 'John' },
          { op: 'add', path: '/user/items', value: [] },
          { op: 'add', path: '/user/items/0', value: 1 },
        ],
        false,
      )
      expect(data).toEqual({
        user: { name: 'John', items: [1] },
      })
    })

    it('should handle boolean operations', () => {
      const data: Record<string, unknown> = { active: true }
      applyPatches(data, [{ op: 'replace', path: '/active', value: false }])
      expect(data.active).toBe(false)
    })

    it('should handle null values in patches', () => {
      const data: Record<string, unknown> = { value: 'something' }
      applyPatches(data, [{ op: 'replace', path: '/value', value: null }])
      expect(data.value).toBe(null)
    })
  })
})

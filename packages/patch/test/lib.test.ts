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

  it('should throw on existing paths for add', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    expect(() => applyPatches(data, [{ op: 'add', path: '/foo/bar', value: 2 }])).toThrow(
      PatchError,
    )
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
})

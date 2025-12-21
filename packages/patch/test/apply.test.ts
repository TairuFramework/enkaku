import { deletePath, getPath, PatchError, parsePath, setPath } from '../src/apply.js'

describe('parsePath()', () => {
  it('should parse simple paths', () => {
    expect(parsePath('/foo')).toEqual(['foo'])
    expect(parsePath('/foo/bar')).toEqual(['foo', 'bar'])
  })

  it('should parse array indices', () => {
    expect(parsePath('/foo/0')).toEqual(['foo', 0])
    expect(parsePath('/foo/1/bar')).toEqual(['foo', 1, 'bar'])
  })

  it('should handle escaped characters', () => {
    expect(parsePath('/foo~1bar')).toEqual(['foo/bar'])
    expect(parsePath('/foo~0bar')).toEqual(['foo~bar'])
  })

  it('should throw on invalid paths', () => {
    expect(() => parsePath('foo')).toThrow(PatchError)
    expect(() => parsePath('foo')).toThrow('Path must start with /')
  })
})

describe('getPath()', () => {
  const obj = {
    foo: {
      bar: [1, 2, 3],
      baz: 'qux',
    },
  }

  it('should get nested values', () => {
    expect(getPath(obj, '/foo/bar')).toEqual([1, 2, 3])
    expect(getPath(obj, '/foo/baz')).toBe('qux')
  })

  it('should get array elements', () => {
    expect(getPath(obj, '/foo/bar/0')).toBe(1)
    expect(getPath(obj, '/foo/bar/1')).toBe(2)
  })

  it('should return undefined for non-existent paths', () => {
    expect(getPath(obj, '/foo/qux')).toBeUndefined()
    expect(getPath(obj, '/foo/bar/5')).toBeUndefined()
  })
})

describe('setPath()', () => {
  it('should set values in objects', () => {
    const obj: Record<string, unknown> = { foo: { bar: 1 } }
    setPath(obj, '/foo/baz', 2)
    expect((obj.foo as Record<string, unknown>).baz).toBe(2)
  })

  it('should set values in arrays', () => {
    const arr = [1, 2, 3]
    setPath(arr, '/1', 4)
    expect(arr).toEqual([1, 4, 3])
  })

  it('should append to arrays', () => {
    const arr = [1, 2, 3]
    setPath(arr, '/3', 4)
    expect(arr).toEqual([1, 2, 3, 4])
  })

  it('should throw on invalid array indices', () => {
    const arr = [1, 2, 3]
    expect(() => setPath(arr, '/5', 4)).toThrow(PatchError)
    expect(() => setPath(arr, '/-1', 4)).toThrow(PatchError)
  })
})

describe('deletePath()', () => {
  it('should delete values from objects', () => {
    const obj: Record<string, unknown> = { foo: { bar: 1, baz: 2 } }
    deletePath(obj, '/foo/bar')
    expect(obj.foo as Record<string, unknown>).toEqual({ baz: 2 })
  })

  it('should delete values from arrays', () => {
    const arr = [1, 2, 3]
    deletePath(arr, '/1')
    expect(arr).toEqual([1, 3])
  })

  it('should throw on non-existent paths', () => {
    const obj: Record<string, unknown> = { foo: { bar: 1 } }
    expect(() => deletePath(obj, '/foo/baz')).toThrow(PatchError)
  })

  it('should not throw on non-existent paths if strict is false', () => {
    const obj: Record<string, unknown> = { foo: { bar: 1 } }
    expect(() => deletePath(obj, '/foo/baz', false)).not.toThrow()
  })
})

describe('PatchError', () => {
  it('should have correct name and code', () => {
    const error = new PatchError('Test message', 'TEST_CODE')
    expect(error.name).toBe('PatchError')
    expect(error.code).toBe('TEST_CODE')
    expect(error.message).toBe('Test message')
  })

  it('should be instanceof Error', () => {
    const error = new PatchError('Test message', 'TEST_CODE')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(PatchError)
  })

  it('should have all error codes', () => {
    const codes = [
      'INVALID_PATH',
      'INVALID_INDEX',
      'PATH_NOT_FOUND',
      'PATH_EXISTS',
      'TEST_FAILED',
      'INVALID_OPERATION',
    ]
    for (const code of codes) {
      const error = new PatchError('Message', code)
      expect(error.code).toBe(code)
    }
  })
})

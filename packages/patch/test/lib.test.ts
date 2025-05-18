import { PatchError, applyPatches } from '../src/index.js'

describe('applyPatches()', () => {
  it('should apply add operations', () => {
    const data: Record<string, unknown> = { foo: { bar: 1 } }
    applyPatches(data, [{ op: 'add', path: '/foo/baz', value: 2 }])
    expect(data).toEqual({ foo: { bar: 1, baz: 2 } })
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
})

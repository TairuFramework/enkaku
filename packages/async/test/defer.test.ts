import { defer } from '../src/defer.js'

describe('defer()', () => {
  test('creates a deferred object with promise, resolve, and reject', () => {
    const deferred = defer<string>()

    expect(deferred).toHaveProperty('promise')
    expect(deferred).toHaveProperty('resolve')
    expect(deferred).toHaveProperty('reject')
    expect(typeof deferred.resolve).toBe('function')
    expect(typeof deferred.reject).toBe('function')
    expect(deferred.promise).toBeInstanceOf(Promise)
  })

  test('resolves when resolve is called', async () => {
    const deferred = defer<string>()
    const testValue = 'test value'

    deferred.resolve(testValue)
    await expect(deferred.promise).resolves.toBe(testValue)
  })

  test('rejects when reject is called', async () => {
    const deferred = defer<string>()
    const testError = new Error('test error')

    deferred.reject(testError)
    await expect(deferred.promise).rejects.toBe(testError)
  })

  test('works with PromiseLike values', async () => {
    const deferred = defer<string>()
    const promiseValue = Promise.resolve('promise value')

    deferred.resolve(promiseValue)
    await expect(deferred.promise).resolves.toBe('promise value')
  })

  test('can be resolved with undefined', async () => {
    const deferred = defer<void>()

    deferred.resolve()
    await expect(deferred.promise).resolves.toBeUndefined()
  })

  test('can be rejected with undefined', async () => {
    const deferred = defer<string>()

    deferred.reject()
    await expect(deferred.promise).rejects.toBeUndefined()
  })
})

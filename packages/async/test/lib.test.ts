import { jest } from '@jest/globals'

import { Disposer, lazy, raceSignal, toPromise } from '../src/index.js'

describe('Disposer', () => {
  test('only disposes once', async () => {
    const disposeFn = jest.fn(() => Promise.resolve())
    const disposer = new Disposer({ dispose: disposeFn })

    await expect(disposer.dispose()).resolves.toBeUndefined()
    await expect(disposer.dispose()).resolves.toBeUndefined()

    expect(disposeFn).toHaveBeenCalledTimes(1)
  })
})

describe('lazy()', () => {
  test('only calls the execute function if needed', () => {
    const execute = jest.fn(() => Promise.resolve())
    const call = lazy(execute)
    expect(execute).not.toHaveBeenCalled()
  })

  test('calls the execute function at most once', async () => {
    const execute = jest.fn(() => Promise.resolve('OK'))
    const call = lazy(execute)
    const res1 = await call
    const res2 = call.then((value) => `value: ${value}`)
    expect(res1).toBe('OK')
    await expect(res2).resolves.toBe('value: OK')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  test('throws errors', async () => {
    const execute = jest.fn(() => Promise.reject('failed'))
    const call = lazy(execute)
    await expect(call).rejects.toBe('failed')
    const res = call.then(
      () => 'success',
      (err) => Promise.reject(`error: ${err}`),
    )
    await expect(res).rejects.toBe('error: failed')
  })
})

describe('toPromise()', () => {
  test('with sync return', async () => {
    await expect(toPromise(() => 'OK')).resolves.toBe('OK')
  })

  test('with sync throw', async () => {
    await expect(
      toPromise(() => {
        throw 'thrown'
      }),
    ).rejects.toBe('thrown')
  })

  test('with resolved promise', async () => {
    await expect(toPromise(() => Promise.resolve('OK'))).resolves.toBe('OK')
  })

  test('with rejected promise', async () => {
    await expect(toPromise(() => Promise.reject('rejected'))).rejects.toBe('rejected')
  })
})

describe('raceSignal()', () => {
  test('with already resolved promise', async () => {
    const controller = new AbortController()
    controller.abort('aborted')
    const promise = Promise.resolve('OK')
    await expect(raceSignal(promise, controller.signal)).resolves.toBe('OK')
  })

  test('with already rejected promise', async () => {
    const controller = new AbortController()
    controller.abort('aborted')
    const promise = Promise.reject('rejected')
    await expect(raceSignal(promise, controller.signal)).rejects.toBe('rejected')
  })

  test('with already aborted signal', async () => {
    const controller = new AbortController()
    controller.abort('aborted')
    const promise = new Promise(() => {})
    await expect(raceSignal(promise, controller.signal)).rejects.toBe(controller.signal.reason)
  })

  test('with promise resolving before signal is aborted', async () => {
    const signal = AbortSignal.timeout(100)
    const promise = new Promise((resolve) => setTimeout(() => resolve('OK'), 50))
    await expect(raceSignal(promise, signal)).resolves.toBe('OK')
  })

  test('with promise rejecting before signal is aborted', async () => {
    const signal = AbortSignal.timeout(100)
    const promise = new Promise((_, reject) => setTimeout(() => reject('rejected'), 50))
    await expect(raceSignal(promise, signal)).rejects.toBe('rejected')
  })

  test('with signal aborting before promise resolves', async () => {
    const signal = AbortSignal.timeout(50)
    const promise = new Promise((resolve) => setTimeout(() => resolve('OK'), 100))
    await expect(raceSignal(promise, signal)).rejects.toThrow(DOMException)
  })

  test('with signal aborting before promise rejects', async () => {
    const signal = AbortSignal.timeout(50)
    const promise = new Promise((_, reject) => setTimeout(() => reject('rejected'), 100))
    await expect(raceSignal(promise, signal)).rejects.toThrow(DOMException)
  })
})

import { raceSignal, toPromise } from '../src/utils.js'

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
    const controller = new AbortController()
    const promise = new Promise((resolve) => setTimeout(() => resolve('OK'), 50))
    setTimeout(() => controller.abort(), 100)
    await expect(raceSignal(promise, controller.signal)).resolves.toBe('OK')
  })

  test('with promise rejecting before signal is aborted', async () => {
    const controller = new AbortController()
    const promise = new Promise((_, reject) => setTimeout(() => reject('rejected'), 50))
    setTimeout(() => controller.abort(), 100)
    await expect(raceSignal(promise, controller.signal)).rejects.toBe('rejected')
  })

  test('with signal aborting before promise resolves', async () => {
    const controller = new AbortController()
    const promise = new Promise((resolve) => setTimeout(() => resolve('OK'), 100))
    setTimeout(() => controller.abort(), 50)
    await expect(raceSignal(promise, controller.signal)).rejects.toThrow(DOMException)
  })

  test('with signal aborting before promise rejects', async () => {
    const controller = new AbortController()
    const promise = new Promise((_, reject) => setTimeout(() => reject('rejected'), 100))
    setTimeout(() => controller.abort(), 50)
    await expect(raceSignal(promise, controller.signal)).rejects.toThrow(DOMException)
  })
})

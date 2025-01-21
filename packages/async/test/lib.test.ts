import { jest } from '@jest/globals'

import { lazy, toPromise } from '../src/index.js'

describe('lazy', () => {
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

import { toPromise } from '../src/index.js'

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

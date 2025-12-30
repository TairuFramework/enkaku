import { describe, expect, test, vi } from 'vitest'

import { Disposer } from '../src/disposer.js'

describe('Disposer', () => {
  test('only disposes once', async () => {
    const disposeFn = vi.fn(() => Promise.resolve())
    const disposer = new Disposer({ dispose: disposeFn })

    await expect(disposer.dispose()).resolves.toBeUndefined()
    await expect(disposer.dispose()).resolves.toBeUndefined()

    expect(disposeFn).toHaveBeenCalledTimes(1)
  })

  test('calls dispose function with abort reason', async () => {
    const disposeFn = vi.fn(() => Promise.resolve())
    const disposer = new Disposer({ dispose: disposeFn })
    const reason = new Error('test reason')

    await disposer.dispose(reason)

    expect(disposeFn).toHaveBeenCalledWith(reason)
  })

  test('resolves disposed promise when dispose is called', async () => {
    const disposer = new Disposer()

    const disposePromise = disposer.dispose()
    await expect(disposePromise).resolves.toBeUndefined()
    await expect(disposer.disposed).resolves.toBeUndefined()
  })

  test('works without dispose function', async () => {
    const disposer = new Disposer()

    await expect(disposer.dispose()).resolves.toBeUndefined()
  })

  test('implements AsyncDisposable', async () => {
    const disposer = new Disposer()

    // Test using await using
    await (async () => {
      await using _ = disposer
      // disposer should be disposed when this block exits
    })()

    expect(disposer.signal.aborted).toBe(true)
  })

  test('listens to external abort signal', async () => {
    const externalController = new AbortController()
    const disposeFn = vi.fn(() => Promise.resolve())
    const disposer = new Disposer({
      dispose: disposeFn,
      signal: externalController.signal,
    })

    externalController.abort('external reason')

    await expect(disposer.disposed).resolves.toBeUndefined()
    expect(disposeFn).toHaveBeenCalledWith('external reason')
  })
})

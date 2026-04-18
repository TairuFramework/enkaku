import { EventEmitter } from '@enkaku/event'
import { describe, expect, test, vi } from 'vitest'

import type { ClientEvents } from '../src/events.js'
import { safeWrite } from '../src/safe-write.js'

function fakeTransport(behaviour: 'ok' | 'closed' | 'boom') {
  return {
    write: vi.fn(async (_: unknown) => {
      if (behaviour === 'closed') {
        throw new TypeError('Invalid state: WritableStream is closed')
      }
      if (behaviour === 'boom') {
        throw new Error('non-benign')
      }
    }),
  }
}

function disposingSignal(): AbortSignal {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
}

describe('client safeWrite', () => {
  test('resolves on clean write without emitting', async () => {
    const transport = fakeTransport('ok')
    const events = new EventEmitter<ClientEvents>()
    const dropped = vi.fn()
    const failed = vi.fn()
    events.on('writeDropped', dropped)
    events.on('writeFailed', failed)

    await safeWrite({
      transport,
      message: 'x',
      events,
      signal: new AbortController().signal,
    })

    expect(dropped).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
  })

  test('swallows benign errors when disposing and emits writeDropped', async () => {
    const transport = fakeTransport('closed')
    const events = new EventEmitter<ClientEvents>()
    const dropped = vi.fn()
    events.on('writeDropped', dropped)

    await safeWrite({ transport, message: 'x', events, signal: disposingSignal() })

    expect(dropped).toHaveBeenCalledWith(expect.objectContaining({ reason: 'disposing' }))
  })

  test('emits writeFailed on non-benign errors and never rejects', async () => {
    const transport = fakeTransport('boom')
    const events = new EventEmitter<ClientEvents>()
    const failed = vi.fn()
    events.on('writeFailed', failed)

    await safeWrite({
      transport,
      message: 'x',
      events,
      signal: new AbortController().signal,
    })

    expect(failed).toHaveBeenCalled()
  })

  test('surfaces benign errors outside disposal via writeFailed', async () => {
    const transport = fakeTransport('closed')
    const events = new EventEmitter<ClientEvents>()
    const failed = vi.fn()
    const dropped = vi.fn()
    events.on('writeFailed', failed)
    events.on('writeDropped', dropped)

    await safeWrite({
      transport,
      message: 'x',
      events,
      signal: new AbortController().signal,
    })

    expect(dropped).not.toHaveBeenCalled()
    expect(failed).toHaveBeenCalled()
  })
})

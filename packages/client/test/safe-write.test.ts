import { EventEmitter } from '@enkaku/event'
import { describe, expect, test, vi } from 'vitest'

import type { ClientEvents } from '../src/events.js'
import { safeWrite } from '../src/safe-write.js'

function fakeTransport(behaviour: 'ok' | 'closed' | 'boom') {
  return {
    write: vi.fn(async () => {
      if (behaviour === 'closed') {
        throw new TypeError('Invalid state: WritableStream is closed')
      }
      if (behaviour === 'boom') {
        throw new Error('non-benign')
      }
    }),
  }
}

describe('client safeWrite', () => {
  test('swallows benign errors when disposing', async () => {
    const transport = fakeTransport('closed')
    const events = new EventEmitter<ClientEvents>()
    const dropped = vi.fn()
    events.on('writeDropped', dropped)

    await safeWrite({ transport, message: 'x', events, disposing: { value: true } })

    expect(dropped).toHaveBeenCalledWith(expect.objectContaining({ reason: 'disposing' }))
  })

  test('rethrows non-benign errors', async () => {
    const transport = fakeTransport('boom')
    const events = new EventEmitter<ClientEvents>()
    await expect(
      safeWrite({ transport, message: 'x', events, disposing: { value: false } }),
    ).rejects.toThrow('non-benign')
  })
})

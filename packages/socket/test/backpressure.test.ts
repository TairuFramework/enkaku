import type { Socket } from 'node:net'
import { PassThrough } from 'node:stream'
import { describe, expect, test, vi } from 'vitest'

import { createTransportStream } from '../src/index.js'

function fakeSocket(): Socket & { paused: boolean } {
  const socket = new PassThrough() as unknown as Socket & PassThrough & { paused: boolean }
  socket.paused = false
  Object.assign(socket, {
    unref: () => socket,
    ref: () => socket,
    pause: vi.fn(() => {
      socket.paused = true
      return socket
    }),
    resume: vi.fn(() => {
      socket.paused = false
      return socket
    }),
  })
  return socket as unknown as Socket & { paused: boolean }
}

describe('socket backpressure', () => {
  test('pauses the socket once the readable queue is full', async () => {
    const socket = fakeSocket()
    await createTransportStream<unknown, unknown>(socket, { highWaterMark: 64 })

    // Nobody reads the readable. Two things matter here:
    //  - the chunks must be *complete* JSON lines, or fromJSONLines buffers them
    //    as a partial line, emits nothing, and never signals backpressure;
    //  - `pipeThrough` drains the source readable eagerly into the transform, so
    //    the source queue only grows once the transform's own queues are full.
    // Hence: feed lines until the socket is paused, with a bounded loop.
    const line = `${JSON.stringify({ v: 'x'.repeat(100) })}\n`
    for (let i = 0; i < 50 && !socket.paused; i++) {
      socket.emit('data', Buffer.from(line))
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    expect(socket.pause).toHaveBeenCalled()
  })

  test('awaits drain when the socket write buffer is full', async () => {
    const socket = fakeSocket()
    let drainPending = false
    // Simulate a full kernel buffer: write() returns false until 'drain' fires.
    socket.write = vi.fn(() => {
      drainPending = true
      return false
    }) as unknown as Socket['write']

    const { writable } = await createTransportStream<unknown, { n: number }>(socket)
    const writer = writable.getWriter()

    const pending = writer.write({ n: 1 })
    let settled = false
    void pending.then(() => {
      settled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(drainPending).toBe(true)
    expect(settled).toBe(false)

    socket.emit('drain')
    await pending
    expect(settled).toBe(true)
  })

  test('a socket closing mid-drain rejects the pending write', async () => {
    const socket = fakeSocket()
    socket.write = vi.fn(() => false) as unknown as Socket['write']

    const { writable } = await createTransportStream<unknown, { n: number }>(socket)
    const writer = writable.getWriter()

    const pending = writer.write({ n: 1 })
    await new Promise((resolve) => setTimeout(resolve, 10))

    socket.emit('close')

    await expect(pending).rejects.toThrow(/closed while draining/i)
  })
})

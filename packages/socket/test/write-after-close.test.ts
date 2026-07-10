import type { Socket } from 'node:net'
import { PassThrough } from 'node:stream'
import { describe, expect, test } from 'vitest'

import { createTransportStream } from '../src/index.js'

/**
 * A duplex stand-in for a Socket. `destroy()` marks it destroyed and emits
 * 'close', mimicking a peer that hung up.
 */
function fakeSocket(): Socket {
  const socket = new PassThrough() as unknown as Socket & PassThrough
  // node:net sockets have these; PassThrough does not.
  Object.assign(socket, {
    unref: () => socket,
    ref: () => socket,
  })
  return socket as unknown as Socket
}

describe('socket write-after-close', () => {
  test('rejects the write instead of emitting an unhandled error', async () => {
    const socket = fakeSocket()
    const { writable } = await createTransportStream<unknown, { hello: string }>(socket)

    socket.destroy()
    // Let the 'close' event settle the readable and run detach().
    await new Promise((resolve) => setTimeout(resolve, 10))

    const writer = writable.getWriter()
    await expect(writer.write({ hello: 'world' })).rejects.toThrow(/closed/i)
  })

  test('a late socket error does not crash the process', async () => {
    const socket = fakeSocket()
    await createTransportStream<unknown, unknown>(socket)

    socket.destroy()
    await new Promise((resolve) => setTimeout(resolve, 10))

    // detach() removes the readable's own 'error' listener, but the
    // permanent listener installed by createTransportStream stays attached.
    // With no listener at all, EventEmitter escalates 'error' into a
    // synchronous throw out of emit() itself (Node's ERR_UNHANDLED_ERROR),
    // not an async 'uncaughtException' -- so that's the mechanism to assert.
    expect(() => socket.emit('error', new Error('EPIPE'))).not.toThrow()
  })
})

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

    const uncaught: Array<Error> = []
    const onUncaught = (err: Error) => uncaught.push(err)
    process.on('uncaughtException', onUncaught)

    try {
      socket.destroy()
      // Let the 'close' event settle the readable and run detach().
      await new Promise((resolve) => setTimeout(resolve, 10))

      const writer = writable.getWriter()
      await expect(writer.write({ hello: 'world' })).rejects.toThrow(/closed/i)

      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(uncaught).toEqual([])
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })

  test('a late socket error does not crash the process', async () => {
    const socket = fakeSocket()
    await createTransportStream<unknown, unknown>(socket)

    const uncaught: Array<Error> = []
    const onUncaught = (err: Error) => uncaught.push(err)
    process.on('uncaughtException', onUncaught)

    try {
      socket.destroy()
      await new Promise((resolve) => setTimeout(resolve, 10))

      // detach() has run. With no listener left, this would be an uncaught throw.
      socket.emit('error', new Error('EPIPE'))
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(uncaught).toEqual([])
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })
})

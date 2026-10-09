import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { defer } from '@sozai/async'
import { describe, expect, test, vi } from 'vitest'

import { Server, serve } from '../src/index.js'

describe.each(['stream', 'channel'] as const)('%s handler backpressure', (type) => {
  test.each([undefined, 3])(
    'bounds awaited writes with highWaterMark %s',
    async (highWaterMark) => {
      const protocol = {
        stream: {
          type: 'stream',
          param: { type: 'null' },
          receive: { type: 'number' },
          result: { type: 'null' },
        },
        channel: {
          type: 'channel',
          param: { type: 'null' },
          send: { type: 'number' },
          receive: { type: 'number' },
          result: { type: 'null' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const capacity = defer<void>()
      const sending = defer<void>()
      const ended = defer<void>()
      const writerStarted = defer<WritableStreamDefaultWriter<number>>()
      const received: Array<number> = []
      const write = transports.server.write.bind(transports.server)
      const stalledWrite = vi
        .spyOn(transports.server, 'write')
        .mockImplementation(async (message) => {
          if (message.payload.typ === 'receive') {
            sending.resolve()
            await capacity.promise
            received.push(message.payload.val)
          }
          await write(message)
        })
      let completed = 0
      const handler = async ({ writable }: { writable: WritableStream<number> }) => {
        const writer = writable.getWriter()
        writerStarted.resolve(writer)
        for (let value = 0; value < 2001; value++) {
          await writer.write(value)
          completed++
        }
        return null
      }
      const server = serve<Protocol>({
        requireAuth: false,
        protocol,
        transport: transports.server,
        streamHighWaterMark: highWaterMark,
        handlers: { stream: handler, channel: handler },
      })
      server.events.on('handlerEnd', () => ended.resolve())

      try {
        await transports.client.write(
          type === 'stream'
            ? createUnsignedToken({ typ: 'stream', prc: 'stream', rid: '1', prm: null } as const)
            : createUnsignedToken({ typ: 'channel', prc: 'channel', rid: '1', prm: null } as const),
        )
        const writer = await writerStarted.promise
        await sending.promise
        // Allow every runnable awaited write to settle while transport capacity stays unavailable.
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        expect.soft(completed).toBeLessThan(2001)
        expect.soft(writer.desiredSize).toBe(0)
        // One value is in the stalled transport send, the rest fill the readable queue.
        expect(completed).toBe((highWaterMark ?? 1) + 1)
        expect(received).toEqual([])

        capacity.resolve()
        await ended.promise
        expect(completed).toBe(2001)
        expect(received).toEqual(Array.from({ length: 2001 }, (_, index) => index))
        expect(writer.desiredSize).toBe(1)
      } finally {
        capacity.resolve()
        await ended.promise
        await server.dispose()
        await transports.dispose()
        stalledWrite.mockRestore()
      }
    },
  )
})

test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'rejects invalid streamHighWaterMark %s',
  (streamHighWaterMark) => {
    expect(() => new Server({ requireAuth: false, handlers: {}, streamHighWaterMark })).toThrow(
      'streamHighWaterMark must be a positive finite integer',
    )
  },
)

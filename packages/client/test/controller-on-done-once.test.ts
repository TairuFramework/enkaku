import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken as unsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/client.js'

const protocol = {
  'test/channel': {
    type: 'channel',
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'string' },
  },
  'test/stream': {
    type: 'stream',
    receive: { type: 'object' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('createController onDone fires at most once', () => {
  test('channel: result then close() does not throw a second writer.close()', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const channel = client.createChannel('test/channel')
      const sentRead = await transports.server.read()
      const rid = sentRead.value?.payload.rid as string

      // Server replies with a final result — fires controller.ok → onDone (1st writer.close).
      await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'OK' }))
      await expect(channel).resolves.toBe('OK')

      // Calling close() on an already-resolved channel fires controller.abort() via the
      // abort listener on controller.signal, which is still registered → controller.aborted()
      // → onDone (2nd writer.close) → throws "Invalid state: WritableStream is closed".
      channel.close()
      // Allow any unhandled rejection to surface.
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(unhandled).not.toHaveBeenCalled()

      await client.dispose()
      await transports.server.dispose()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  test('stream: result then close() does not throw a second writer.close()', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const stream = client.createStream('test/stream')
      const sentRead = await transports.server.read()
      const rid = sentRead.value?.payload.rid as string

      await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'OK' }))
      await expect(stream).resolves.toBe('OK')

      // Fire the per-rid abort after the stream already resolved.
      stream.close()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(unhandled).not.toHaveBeenCalled()

      await client.dispose()
      await transports.server.dispose()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  test('channel: error reply then close() does not throw a second writer.close()', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const channel = client.createChannel('test/channel')
      // Channel rejects on error reply; swallow so the rejection isn't unhandled.
      void channel.catch(() => {})

      const sentRead = await transports.server.read()
      const rid = sentRead.value?.payload.rid as string

      // Server replies with an error — fires controller.error → onDone (1st writer.close).
      await transports.server.write(
        unsignedToken({ typ: 'error', rid, code: 'boom', msg: 'boom', data: {} }),
      )
      await expect(channel).rejects.toBeDefined()

      // close() fires the per-rid abort → controller.aborted → onDone (would be 2nd writer.close).
      channel.close()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(unhandled).not.toHaveBeenCalled()

      await client.dispose()
      await transports.server.dispose()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})

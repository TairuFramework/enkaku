import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { Transport } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

type ClientTransport = Transport<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>

function createControllableTransport(): {
  transport: ClientTransport
  endReadable: () => void
} {
  let endReadable = () => {}
  const readable = new ReadableStream<AnyServerMessageOf<Protocol>>({
    start(controller) {
      endReadable = () => controller.close()
    },
  })
  const transport = new Transport<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>({
    stream: { readable, writable: new WritableStream<AnyClientMessageOf<Protocol>>() },
  })
  return { transport, endReadable: () => endReadable() }
}

describe('stale read loop', () => {
  test('a read loop parked on a replaced transport does not dispose the replacement', async () => {
    const a = createControllableTransport()
    const b = createControllableTransport()

    let bDisposed = false
    b.transport.events.on('disposed', () => {
      bDisposed = true
    })

    let disposedHandlerCalls = 0
    const client = new Client<Protocol>({
      transport: a.transport,
      handleTransportDisposed: () => {
        disposedHandlerCalls += 1
        // Provide the replacement once; a second call means the client is being
        // told the replacement itself died, which must not happen here.
        return disposedHandlerCalls === 1 ? b.transport : undefined
      },
    })

    const replaced = new Promise<void>((resolve) => {
      client.events.on('transportReplaced', () => resolve())
    })

    // Dispose transport A externally — the reconnect trigger handleTransportDisposed
    // exists for. `Transport.dispose` only closes the writable, so A's readable
    // stays open and the read loop started for A is still parked on its reader.
    await a.transport.dispose()
    await replaced

    // A's readable now ends (peer EOF). The loop that owns it is stale: the
    // client has been on transport B since the replacement.
    a.endReadable()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(bDisposed).toBe(false)
    expect(disposedHandlerCalls).toBe(1)
    expect(client.signal.aborted).toBe(false)

    await client.dispose()
  })
})

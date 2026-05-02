import { Client } from '@enkaku/client'
import type { StoredMessage, StoreParams } from '@enkaku/hub-protocol'
import {
  createHubTunnelTransport,
  type HubLike,
  type HubReceiveSubscription,
} from '@enkaku/hub-tunnel'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, type RequestHandler, serve } from '@enkaku/server'
import { describe, expect, test } from 'vitest'

// ---------------------------------------------------------------------------
// In-memory HubLike double
// ---------------------------------------------------------------------------

type Inbox = {
  messages: Array<StoredMessage>
  wakers: Array<(msg: StoredMessage) => void>
}

function createInMemoryHub(): { hubFor: (localDID: string) => HubLike } {
  const inboxes: Record<string, Inbox> = {}
  let seq = 0

  function getInbox(did: string): Inbox {
    if (inboxes[did] == null) {
      inboxes[did] = { messages: [], wakers: [] }
    }
    return inboxes[did] as Inbox
  }

  async function send(params: StoreParams): Promise<{ sequenceID: string }> {
    const sequenceID = String(++seq)
    const stored: StoredMessage = {
      sequenceID,
      senderDID: params.senderDID,
      payload: params.payload,
    }
    for (const recipient of params.recipients) {
      const inbox = getInbox(recipient)
      const waker = inbox.wakers.shift()
      if (waker != null) {
        waker(stored)
      } else {
        inbox.messages.push(stored)
      }
    }
    return { sequenceID }
  }

  function receive(localDID: string): HubReceiveSubscription {
    const inbox = getInbox(localDID)
    let done = false

    return {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<StoredMessage>> {
            if (done) {
              return Promise.resolve({ value: undefined as unknown as StoredMessage, done: true })
            }
            const queued = inbox.messages.shift()
            if (queued != null) {
              return Promise.resolve({ value: queued, done: false })
            }
            return new Promise<IteratorResult<StoredMessage>>((resolve) => {
              inbox.wakers.push((msg) => {
                resolve({ value: msg, done: false })
              })
            })
          },
          return(): Promise<IteratorResult<StoredMessage>> {
            done = true
            // Wake any pending waker so the iterator loop can exit
            const waker = inbox.wakers.shift()
            if (waker != null) {
              waker({ sequenceID: '', senderDID: '', payload: new Uint8Array(0) })
            }
            return Promise.resolve({ value: undefined as unknown as StoredMessage, done: true })
          },
        }
      },
    }
  }

  function hubFor(localDID: string): HubLike {
    return { send, receive }
  }

  return { hubFor }
}

// ---------------------------------------------------------------------------
// Protocol
// ---------------------------------------------------------------------------

const protocol = {
  echo: {
    type: 'request',
    param: {
      type: 'object',
      properties: { msg: { type: 'string' } },
      required: ['msg'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: { msg: { type: 'string' } },
      required: ['msg'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('hub-tunnel echo', () => {
  test('client → server round-trip via in-memory hub', async () => {
    const { hubFor } = createInMemoryHub()

    const clientTransport = createHubTunnelTransport<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >({
      hub: hubFor('client'),
      sessionID: 'session-1',
      localDID: 'client',
      peerDID: 'server',
    })

    const serverTransport = createHubTunnelTransport<
      AnyClientMessageOf<Protocol>,
      AnyServerMessageOf<Protocol>
    >({
      hub: hubFor('server'),
      sessionID: 'session-1',
      localDID: 'server',
      peerDID: 'client',
    })

    const echoHandler: RequestHandler<Protocol, 'echo'> = async ({ param }) => param
    const handlers = { echo: echoHandler } as ProcedureHandlers<Protocol>

    const server = serve<Protocol>({ handlers, accessControl: false, transport: serverTransport })
    const client = new Client<Protocol>({ transport: clientTransport })

    try {
      const result = await client.request('echo', { param: { msg: 'hello' } })
      expect(result).toEqual({ msg: 'hello' })
    } finally {
      await client.dispose()
      await server.dispose()
    }
  })
})

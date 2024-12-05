/**
 * HTTP transport for Enkaku RPC clients.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/http-client-transport
 * ```
 *
 * @module http-client-transport
 */

import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createReadable } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

const HEADERS = { accept: 'application/json', 'content-type': 'application/json' }

export type EventStream = {
  id: string
  close: () => void
}

export async function createEventStream<Protocol extends ProtocolDefinition>(
  url: string,
  onMessage: (msg: AnyServerMessageOf<Protocol>) => void,
): Promise<EventStream> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to access event source')
  }

  const data = (await res.json()) as { id: string }
  const sourceURL = new URL(url)
  sourceURL.searchParams.set('id', data.id)
  const source = new EventSource(sourceURL)
  source.onmessage = (event) => {
    void onMessage(JSON.parse(event.data))
  }
  return {
    id: data.id,
    close: () => {
      source.close()
    },
  }
}

type TransportStream<Protocol extends ProtocolDefinition> = ReadableWritablePair<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> & { controller: ReadableStreamDefaultController<AnyServerMessageOf<Protocol>> }

export function createTransportStream<Protocol extends ProtocolDefinition>(
  url: string,
  onErrorResponse?: (response: Response) => void,
): TransportStream<Protocol> {
  const [readable, controller] = createReadable<AnyServerMessageOf<Protocol>>()

  // Lazily get the SSE stream:
  // - Only connect if there is a stateful request (channel or stream)
  // - Only create a single SSE connection for all requests
  let eventStreamPromise: Promise<EventStream> | undefined
  function getEventStream() {
    if (eventStreamPromise == null) {
      eventStreamPromise = createEventStream<Protocol>(url, (msg) => {
        controller.enqueue(msg)
      })
    }
    return eventStreamPromise
  }

  async function sendMessage(msg: AnyClientMessageOf<Protocol>, sessionID?: string): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: sessionID ? { ...HEADERS, 'enkaku-session-id': sessionID } : HEADERS,
    })
    if (res.ok) {
      if (res.status !== 204) {
        res.json().then((msg) => controller.enqueue(msg))
      }
    } else {
      onErrorResponse?.(res)
    }
  }

  const writable = new WritableStream<AnyClientMessageOf<Protocol>>({
    async write(msg) {
      if (msg.payload.typ === 'channel' || msg.payload.typ === 'stream') {
        const session = await getEventStream()
        await sendMessage(msg, session.id)
      } else {
        await sendMessage(msg)
      }
    },
    // The transport will call this method when disposing
    async close() {
      // Close the SSE stream if active
      if (eventStreamPromise != null) {
        const eventStream = await eventStreamPromise
        eventStream.close()
      }
    },
  })

  return { controller, readable, writable }
}

export type ClientTransportParams = {
  url: string
  onErrorResponse?: (response: Response) => void
}

export class ClientTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  constructor(params: ClientTransportParams) {
    super({ stream: createTransportStream<Protocol>(params.url) })
  }
}

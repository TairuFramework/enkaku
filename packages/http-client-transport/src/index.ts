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

import type { AnyClientMessageOf, AnyDefinitions, AnyServerMessageOf } from '@enkaku/protocol'
import { createReadable } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

const HEADERS = { accept: 'application/json', 'content-type': 'application/json' }

export type EventStream = {
  id: string
  close: () => void
}

export async function createEventStream<Definitions extends AnyDefinitions>(
  url: string,
  onMessage: (msg: AnyServerMessageOf<Definitions>) => void,
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

type TransportStream<Definitions extends AnyDefinitions> = ReadableWritablePair<
  AnyServerMessageOf<Definitions>,
  AnyClientMessageOf<Definitions>
> & { controller: ReadableStreamDefaultController<AnyServerMessageOf<Definitions>> }

export function createTransportStream<Definitions extends AnyDefinitions>(
  url: string,
  onErrorResponse?: (response: Response) => void,
): TransportStream<Definitions> {
  const [readable, controller] = createReadable<AnyServerMessageOf<Definitions>>()

  // Lazily get the SSE stream:
  // - Only connect if there is a stateful request (channel or stream)
  // - Only create a single SSE connection for all requests
  let eventStreamPromise: Promise<EventStream> | undefined
  function getEventStream() {
    if (eventStreamPromise == null) {
      eventStreamPromise = createEventStream<Definitions>(url, (msg) => {
        controller.enqueue(msg)
      })
    }
    return eventStreamPromise
  }

  async function sendMessage(
    msg: AnyClientMessageOf<Definitions>,
    sessionID?: string,
  ): Promise<void> {
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

  const writable = new WritableStream<AnyClientMessageOf<Definitions>>({
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

export class ClientTransport<Definitions extends AnyDefinitions> extends Transport<
  AnyServerMessageOf<Definitions>,
  AnyClientMessageOf<Definitions>
> {
  constructor(params: ClientTransportParams) {
    super({ stream: createTransportStream(params.url) })
  }
}

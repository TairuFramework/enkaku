import type { AnyClientMessageOf, AnyDefinitions, AnyServerMessageOf } from '@enkaku/protocol'
import { createReadable } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'
import { ofetch } from 'ofetch'

export type EventStream = {
  id: string
  close: () => void
}

export async function createEventStream<Definitions extends AnyDefinitions>(
  url: string,
  onMessage: (msg: AnyServerMessageOf<Definitions>) => void,
): Promise<EventStream> {
  const res = await ofetch<{ id: string }>(url)
  const sourceURL = new URL(url)
  sourceURL.searchParams.set('id', res.id)
  const source = new EventSource(sourceURL)
  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data))
    } catch (err) {
      console.warn('Event stream onMessage error', err)
    }
  }
  return { id: res.id, close: source.close }
}

type TransportStream<Definitions extends AnyDefinitions> = ReadableWritablePair<
  AnyServerMessageOf<Definitions>,
  AnyClientMessageOf<Definitions>
> & { controller: ReadableStreamDefaultController<AnyServerMessageOf<Definitions>> }

export function createTransportStream<Definitions extends AnyDefinitions>(
  url: string,
): TransportStream<Definitions> {
  const [readable, controller] = createReadable<AnyServerMessageOf<Definitions>>()

  // Lazily get the SSE stream:
  // - Only connect if there is a stateful request (channel or stream)
  // - Only create a single SSE connection for all requests
  let eventStreamPromise: Promise<EventStream> | undefined
  function getEventStream() {
    if (eventStreamPromise == null) {
      eventStreamPromise = createEventStream(url, controller.enqueue)
    }
    return eventStreamPromise
  }

  function sendMessage(msg: AnyClientMessageOf<Definitions>, sessionID?: string) {
    ofetch(url, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: sessionID ? { 'enkaku-session-id': sessionID } : {},
    }).then(
      (res) => {
        if (res != null) {
          controller.enqueue(res)
        }
      },
      (err) => {
        console.warn('fetch error', err)
      },
    )
  }

  const writable = new WritableStream<AnyClientMessageOf<Definitions>>({
    write(msg) {
      if (msg.payload.typ === 'channel' || msg.payload.typ === 'stream') {
        getEventStream().then((session) => sendMessage(msg, session.id))
      } else {
        sendMessage(msg)
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
}

export class ClientTransport<Definitions extends AnyDefinitions> extends Transport<
  AnyServerMessageOf<Definitions>,
  AnyClientMessageOf<Definitions>
> {
  constructor(params: ClientTransportParams) {
    super({ stream: createTransportStream(params.url) })
  }
}

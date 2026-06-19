import { fromUTF, toUTF } from '@enkaku/codec'
import { Transport, type TransportType } from '@enkaku/transport'

import type { BroadcastBus } from './bus.js'

/** Message shape carried on a broadcast topic. */
export type BroadcastMessage = {
  payload: { typ: string; prc?: string; data?: unknown; [key: string]: unknown }
}

export type ByteTransform = (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>

export type BroadcastTransportParams = {
  topicID: string
  bus: BroadcastBus
  wrap?: ByteTransform
  unwrap?: ByteTransform
  signal?: AbortSignal
}

const identity: ByteTransform = (bytes) => bytes

function encode(value: unknown): Uint8Array {
  return fromUTF(JSON.stringify(value))
}

function decode<R>(bytes: Uint8Array): R {
  return JSON.parse(toUTF(bytes)) as R
}

/**
 * Create a `TransportType` bound to a single broadcast topic. Writes fan out to
 * every transport subscribed to the topic; reads merge inbound topic messages.
 * Only fire-and-forget event traffic is meaningful here — request/stream/channel
 * `rid` correlation does not survive 1→N fan-out (the `BroadcastClient` models
 * anycast on top of events instead).
 */
export function createBroadcastTransport<R = BroadcastMessage, W = BroadcastMessage>(
  params: BroadcastTransportParams,
): TransportType<R, W> {
  const { topicID, bus, wrap = identity, unwrap = identity, signal } = params

  let unsubscribe: (() => void) | undefined
  let readableController: ReadableStreamDefaultController<R> | undefined
  let readerClosed = false

  function closeReadable() {
    if (!readerClosed) {
      readerClosed = true
      try {
        readableController?.close()
      } catch {
        // already closed or errored — ignore
      }
    }
  }

  const readable = new ReadableStream<R>({
    start(controller) {
      readableController = controller
      unsubscribe = bus.subscribe(topicID, (payload) => {
        Promise.resolve(unwrap(payload))
          .then((bytes) => controller.enqueue(decode<R>(bytes)))
          .catch(() => {
            // Per-message decode/unwrap failure: drop this message and keep the
            // subscription alive so later valid messages still arrive.
            // Expected for messages from other groups/epochs where decryption fails.
          })
      })
    },
    cancel() {
      unsubscribe?.()
      unsubscribe = undefined
      readerClosed = true
    },
  })

  const writable = new WritableStream<W>({
    async write(value) {
      const typ = (value as BroadcastMessage | undefined)?.payload?.typ
      if (typ !== 'event') {
        throw new Error(
          `Broadcast transport only carries 'event' payloads; got '${typ ?? 'undefined'}'`,
        )
      }
      const bytes = await wrap(encode(value))
      await bus.publish(topicID, bytes)
    },
    close() {
      // Bug 1 fix: also close the readable controller so parked readers unblock.
      unsubscribe?.()
      unsubscribe = undefined
      closeReadable()
    },
  })

  return new Transport<R, W>({ stream: { readable, writable }, signal })
}

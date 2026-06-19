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
  const readable = new ReadableStream<R>({
    start(controller) {
      unsubscribe = bus.subscribe(topicID, (payload) => {
        Promise.resolve(unwrap(payload))
          .then((bytes) => controller.enqueue(decode<R>(bytes)))
          .catch((error) => controller.error(error))
      })
    },
    cancel() {
      unsubscribe?.()
    },
  })

  const writable = new WritableStream<W>({
    async write(value) {
      const bytes = await wrap(encode(value))
      await bus.publish(topicID, bytes)
    },
    close() {
      unsubscribe?.()
    },
  })

  return new Transport<R, W>({ stream: { readable, writable }, signal })
}

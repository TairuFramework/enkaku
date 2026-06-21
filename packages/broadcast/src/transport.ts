import { Transport, type TransportType } from '@enkaku/transport'
import { fromUTF, toUTF } from '@sozai/codec'

import type { BroadcastBus } from './bus.js'

/** Message shape carried on a broadcast topic. */
export type BroadcastMessage = {
  payload: { typ: string; prc?: string; data?: unknown; [key: string]: unknown }
  /** Authenticated sender recovered by `unwrap` (e.g. the MLS credential). */
  senderDID?: string
}

export type ByteTransform = (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>

/** Result of unwrapping inbound bytes: plaintext plus the recovered sender. */
export type UnwrapResult = { payload: Uint8Array; senderDID?: string }

/**
 * Inbound transform. May return raw plaintext bytes (no sender) or an
 * {@link UnwrapResult} carrying the authenticated `senderDID` recovered from the
 * ciphertext (the producer embeds it via `wrap`/encryption).
 */
export type Unwrap = (
  bytes: Uint8Array,
) => Uint8Array | UnwrapResult | Promise<Uint8Array | UnwrapResult>

export type BroadcastTransportParams = {
  topicID: string
  bus: BroadcastBus
  wrap?: ByteTransform
  unwrap?: Unwrap
  signal?: AbortSignal
}

const identityWrap: ByteTransform = (bytes) => bytes
const identityUnwrap: Unwrap = (bytes) => bytes

function encode(value: unknown): Uint8Array {
  return fromUTF(JSON.stringify(value))
}

function decode<R>(bytes: Uint8Array): R {
  return JSON.parse(toUTF(bytes)) as R
}

function normalizeUnwrap(result: Uint8Array | UnwrapResult): UnwrapResult {
  return result instanceof Uint8Array ? { payload: result } : result
}

/**
 * Create a `TransportType` bound to a single broadcast topic. Writes fan out to
 * every transport subscribed to the topic; reads merge inbound topic messages.
 * Only fire-and-forget event traffic is meaningful here — request/stream/channel
 * `rid` correlation does not survive 1→N fan-out (the `BroadcastClient` models
 * anycast on top of events instead). When `unwrap` recovers a `senderDID`, it is
 * attached to the enqueued message.
 */
export function createBroadcastTransport<R = BroadcastMessage, W = BroadcastMessage>(
  params: BroadcastTransportParams,
): TransportType<R, W> {
  const { topicID, bus, wrap = identityWrap, unwrap = identityUnwrap, signal } = params

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
          .then((result) => {
            const { payload: bytes, senderDID } = normalizeUnwrap(result)
            const message = decode<R>(bytes)
            if (senderDID != null) {
              ;(message as BroadcastMessage).senderDID = senderDID
            }
            controller.enqueue(message)
          })
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
      unsubscribe?.()
      unsubscribe = undefined
      closeReadable()
    },
  })

  return new Transport<R, W>({ stream: { readable, writable }, signal })
}

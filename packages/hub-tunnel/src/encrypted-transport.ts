import { fromB64, toB64 } from '@enkaku/codec'
import type { StoredMessage, StoreParams } from '@enkaku/hub-protocol'
import type { TransportType } from '@enkaku/transport'

import type { Encryptor } from './encryptor.js'
import { decodeEnvelope, encodeEnvelope, type TunnelEnvelope } from './envelope.js'
import { DecryptError, EncryptError, EnvelopeDecodeError } from './errors.js'
import type { ObservabilityEventListener } from './events.js'
import {
  createHubTunnelTransport,
  type HubLike,
  type HubReceiveSubscription,
  type HubTunnelTransportParams,
} from './transport.js'

export type EncryptedHubTunnelTransportParams = HubTunnelTransportParams & {
  encryptor: Encryptor
  groupID: string
}

type WrapHubParams = {
  hub: HubLike
  encryptor: Encryptor
  groupID: string
  onEvent?: ObservabilityEventListener
  onEncryptError: (error: EncryptError) => void
}

function wrapHub({ hub, encryptor, groupID, onEvent, onEncryptError }: WrapHubParams): HubLike {
  const wrapped: HubLike = {
    async send(params: StoreParams): Promise<{ sequenceID: string }> {
      let ciphertextBytes: Uint8Array
      try {
        ciphertextBytes = await encryptor.encrypt(params.payload)
      } catch (cause) {
        const err = new EncryptError('encrypt failed', { cause })
        onEncryptError(err)
        throw err
      }
      const envelope: TunnelEnvelope = {
        v: 1,
        groupID,
        ciphertext: toB64(ciphertextBytes),
      }
      return await hub.send({
        senderDID: params.senderDID,
        recipients: params.recipients,
        payload: encodeEnvelope(envelope),
        ...(params.groupID == null ? {} : { groupID: params.groupID }),
      })
    },
    receive(deviceDID: string): HubReceiveSubscription {
      const inner = hub.receive(deviceDID)
      const innerIterator = inner[Symbol.asyncIterator]()

      const iterator: AsyncIterator<StoredMessage> = {
        async next(): Promise<IteratorResult<StoredMessage>> {
          while (true) {
            const result = await innerIterator.next()
            if (result.done) {
              return { value: undefined as unknown as StoredMessage, done: true }
            }
            const message = result.value
            let envelope: TunnelEnvelope
            try {
              envelope = decodeEnvelope(message.payload)
            } catch (error) {
              if (error instanceof EnvelopeDecodeError) {
                onEvent?.({ type: 'envelope-decode-failed', error })
                onEvent?.({ type: 'frame-dropped', reason: 'envelope-decode' })
                continue
              }
              throw error
            }
            let plaintext: Uint8Array
            try {
              plaintext = await encryptor.decrypt(fromB64(envelope.ciphertext))
            } catch (cause) {
              const err = new DecryptError('decrypt failed', { cause })
              onEvent?.({ type: 'decrypt-failed', error: err })
              onEvent?.({ type: 'frame-dropped', reason: 'decrypt' })
              continue
            }
            const decrypted: StoredMessage = {
              sequenceID: message.sequenceID,
              senderDID: message.senderDID,
              payload: plaintext,
              ...(message.groupID == null ? {} : { groupID: message.groupID }),
            }
            return { value: decrypted, done: false }
          }
        },
        return(): Promise<IteratorResult<StoredMessage>> {
          innerIterator.return?.()
          return Promise.resolve({ value: undefined as unknown as StoredMessage, done: true })
        },
      }

      return {
        [Symbol.asyncIterator]() {
          return iterator
        },
        // Subscription-level dispose. `createHubTunnelTransport` only ever
        // calls `iterator.return?.()`, so this path is unreachable from
        // inside this package; it exists for callers that hold the
        // subscription object directly. Invoking it disposes the underlying
        // tunnel inbox and breaks the listener "shared inbox across spawns"
        // pattern — only call from a stop/cleanup path that is intentionally
        // tearing down the whole stream.
        return() {
          inner.return?.()
        },
      }
    },
  }
  if (hub.events != null) {
    wrapped.events = hub.events
  }
  return wrapped
}

export function createEncryptedHubTunnelTransport<R, W>(
  params: EncryptedHubTunnelTransportParams,
): TransportType<R, W> {
  const { hub, encryptor, groupID, onEvent, signal: externalSignal, ...rest } = params

  const internalController = new AbortController()
  if (externalSignal != null) {
    if (externalSignal.aborted) {
      internalController.abort(externalSignal.reason)
    } else {
      externalSignal.addEventListener(
        'abort',
        () => {
          internalController.abort(externalSignal.reason)
        },
        { once: true },
      )
    }
  }

  const wrappedHub = wrapHub({
    hub,
    encryptor,
    groupID,
    onEvent,
    onEncryptError: (err) => {
      internalController.abort(err)
    },
  })

  return createHubTunnelTransport<R, W>({
    ...rest,
    hub: wrappedHub,
    signal: internalController.signal,
    onEvent,
  })
}

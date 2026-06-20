import { fromB64, toB64 } from '@enkaku/codec'
import type { StoredMessage } from '@enkaku/hub-protocol'
import type { TransportType } from '@enkaku/transport'

import type { Encryptor } from './encryptor.js'
import { decodeEnvelope, encodeEnvelope, type TunnelEnvelope } from './envelope.js'
import { DecryptError, EncryptError, EnvelopeDecodeError } from './errors.js'
import type { ObservabilityEventListener } from './events.js'
import {
  createHubTunnelTransport,
  type HubLike,
  type HubPublishParams,
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
    async publish(params: HubPublishParams): Promise<{ sequenceID: string }> {
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
      return await hub.publish({
        senderDID: params.senderDID,
        topicID: params.topicID,
        payload: encodeEnvelope(envelope),
      })
    },
    subscribe(subscriberDID: string, topicID: string): Promise<void> | void {
      return hub.subscribe(subscriberDID, topicID)
    },
    unsubscribe(subscriberDID: string, topicID: string): Promise<void> | void {
      return hub.unsubscribe?.(subscriberDID, topicID)
    },
    receive(subscriberDID: string): HubReceiveSubscription {
      const inner = hub.receive(subscriberDID)
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
              topicID: message.topicID,
              payload: plaintext,
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

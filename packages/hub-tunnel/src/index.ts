// @enkaku/hub-tunnel — peer-to-peer Enkaku transport over the hub relay
export {
  createEncryptedHubTunnelTransport,
  type EncryptedHubTunnelTransportParams,
} from './encrypted-transport.js'
export type { Encryptor } from './encryptor.js'
export {
  decodeEnvelope,
  encodeEnvelope,
  TUNNEL_ENVELOPE_VERSION,
  type TunnelEnvelope,
  tunnelEnvelopeSchema,
} from './envelope.js'
export {
  BackpressureError,
  DecryptError,
  EncryptError,
  EnvelopeDecodeError,
  FrameDecodeError,
  HubReconnectingError,
  SessionNotEstablishedError,
} from './errors.js'
export type {
  FrameDroppedReason,
  ObservabilityEvent,
  ObservabilityEventListener,
} from './events.js'
export {
  decodeFrame,
  encodeFrame,
  HUB_FRAME_VERSION,
  type HubFrame,
  type HubFrameMessageBody,
  hubFrameSchema,
} from './frame.js'
export {
  createHubTunnelTransport,
  type HubLike,
  type HubLikeEvent,
  type HubLikeEventListener,
  type HubLikeEvents,
  type HubReceiveSubscription,
  type HubTunnelSessionID,
  type HubTunnelTransportParams,
} from './transport.js'

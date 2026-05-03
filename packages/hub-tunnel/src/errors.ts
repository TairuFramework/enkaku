export class FrameDecodeError extends Error {
  override name = 'FrameDecodeError'
}

export class EnvelopeDecodeError extends Error {
  override name = 'EnvelopeDecodeError'
}

export class DecryptError extends Error {
  override name = 'DecryptError'
}

export class EncryptError extends Error {
  override name = 'EncryptError'
}

export class BackpressureError extends Error {
  override name = 'BackpressureError'
}

export class HubReconnectingError extends Error {
  override name = 'HubReconnectingError'
}

export class SessionNotEstablishedError extends Error {
  override name = 'SessionNotEstablishedError'
}

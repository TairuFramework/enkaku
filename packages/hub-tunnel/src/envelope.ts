import { createValidator, type Schema } from '@enkaku/schema'

import { EnvelopeDecodeError } from './errors.js'

export const TUNNEL_ENVELOPE_VERSION = 1

export type TunnelEnvelope = {
  v: 1
  groupID: string
  ciphertext: string
}

export const tunnelEnvelopeSchema = {
  $id: 'urn:enkaku:hub-tunnel:envelope',
  type: 'object',
  properties: {
    v: { type: 'integer', const: TUNNEL_ENVELOPE_VERSION },
    groupID: { type: 'string' },
    ciphertext: { type: 'string' },
  },
  required: ['v', 'groupID', 'ciphertext'],
  additionalProperties: false,
} as const satisfies Schema

const validateTunnelEnvelope = createValidator(tunnelEnvelopeSchema)

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function encodeEnvelope(envelope: TunnelEnvelope): Uint8Array {
  return textEncoder.encode(JSON.stringify(envelope))
}

export function decodeEnvelope(bytes: Uint8Array): TunnelEnvelope {
  let text: string
  try {
    text = textDecoder.decode(bytes)
  } catch (cause) {
    throw new EnvelopeDecodeError('Envelope bytes are not valid UTF-8', { cause })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new EnvelopeDecodeError('Envelope is not valid JSON', { cause })
  }

  const result = validateTunnelEnvelope(parsed)
  if ('issues' in result) {
    throw new EnvelopeDecodeError('Envelope failed schema validation', { cause: result })
  }
  return result.value as TunnelEnvelope
}

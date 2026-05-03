import { createValidator, type Schema } from '@enkaku/schema'

import { FrameDecodeError } from './errors.js'

export const HUB_FRAME_VERSION = 1

// Permissive envelope schema: validates {header: object, payload: {typ: string}}
// without enforcing JWT-specific header constraints (e.g. typ:'JWT').
// Payload-shape validation is left to the consumer's own protocol schema.
const enkakuMessageSchema = {
  type: 'object',
  properties: {
    header: { type: 'object', additionalProperties: true },
    payload: {
      type: 'object',
      properties: { typ: { type: 'string' } },
      required: ['typ'],
      additionalProperties: true,
    },
    signature: { type: 'string' },
    data: { type: 'string' },
  },
  required: ['header', 'payload'],
  additionalProperties: false,
} as const satisfies Schema

const messageFrameSchema = {
  type: 'object',
  properties: {
    v: { type: 'integer', const: HUB_FRAME_VERSION },
    sessionID: { type: 'string' },
    seq: { type: 'integer' },
    correlationID: { type: 'string' },
    kind: { type: 'string', const: 'message' },
    body: enkakuMessageSchema,
  },
  required: ['v', 'sessionID', 'seq', 'kind', 'body'],
  additionalProperties: false,
} as const satisfies Schema

const sessionEndFrameSchema = {
  type: 'object',
  properties: {
    v: { type: 'integer', const: HUB_FRAME_VERSION },
    sessionID: { type: 'string' },
    seq: { type: 'integer' },
    correlationID: { type: 'string' },
    kind: { type: 'string', const: 'session-end' },
    reason: { type: 'string' },
  },
  required: ['v', 'sessionID', 'seq', 'kind'],
  additionalProperties: false,
} as const satisfies Schema

export const hubFrameSchema = {
  $id: 'urn:enkaku:hub-tunnel:frame',
  oneOf: [messageFrameSchema, sessionEndFrameSchema],
} as const satisfies Schema

export type HubFrameMessageBody = {
  header: Record<string, unknown>
  payload: { typ: string; [key: string]: unknown }
  signature?: string
  data?: string
}

export type HubFrame =
  | {
      v: 1
      sessionID: string
      seq: number
      correlationID?: string
      kind: 'message'
      body: HubFrameMessageBody
    }
  | {
      v: 1
      sessionID: string
      seq: number
      correlationID?: string
      kind: 'session-end'
      reason?: string
    }

const validateHubFrame = createValidator(hubFrameSchema)

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function encodeFrame(frame: HubFrame): Uint8Array {
  return textEncoder.encode(JSON.stringify(frame))
}

export function decodeFrame(bytes: Uint8Array): HubFrame {
  let text: string
  try {
    text = textDecoder.decode(bytes)
  } catch (cause) {
    throw new FrameDecodeError('Frame bytes are not valid UTF-8', { cause })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new FrameDecodeError('Frame is not valid JSON', { cause })
  }

  const result = validateHubFrame(parsed)
  if ('issues' in result) {
    throw new FrameDecodeError('Frame failed schema validation', { cause: result })
  }
  return result.value as HubFrame
}

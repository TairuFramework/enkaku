import type { Schema } from '@enkaku/schema'

import type {
  AnyCommandProtocol,
  ChannelCommandProtocol,
  CommandsRecordProtocol,
  RequestCommandProtocol,
  StreamCommandProtocol,
} from '../types/protocol.js'

import { createMessageSchema } from './message.js'

export const errorMessageSchema: Schema = createMessageSchema({
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'error' },
    rid: { type: 'string' },
    code: { type: 'string' },
    msg: { type: 'string' },
    data: { type: 'object' },
    jti: { type: 'string' },
  },
  required: ['typ', 'rid', 'code', 'msg'],
  additionalProperties: false,
} as const satisfies Schema)

export function createReceiveMessageSchema(
  protocol: StreamCommandProtocol | ChannelCommandProtocol,
): Schema {
  const payloadSchema = {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'receive' },
      rid: { type: 'string' },
      val: protocol.receive,
      jti: { type: 'string' },
    },
    required: ['typ', 'rid', 'val'],
    additionalProperties: false,
  } as const satisfies Schema
  return createMessageSchema(payloadSchema)
}

export function createResultMessageWithValue(valueSchema: Schema): Schema {
  return createMessageSchema({
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'result' },
      rid: { type: 'string' },
      val: valueSchema,
      jti: { type: 'string' },
    },
    required: ['typ', 'rid', 'val'],
    additionalProperties: false,
  } as const satisfies Schema)
}

export const resultMessageWithoutValue: Schema = createMessageSchema({
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'result' },
    rid: { type: 'string' },
    jti: { type: 'string' },
  },
  required: ['typ', 'rid'],
  additionalProperties: false,
} as const satisfies Schema)

export function createResultMessageSchema(
  protocol: RequestCommandProtocol | StreamCommandProtocol | ChannelCommandProtocol,
): Schema {
  return protocol.result ? createResultMessageWithValue(protocol.result) : resultMessageWithoutValue
}

export function createServerMessageSchema<Commands extends string>(
  protocol: CommandsRecordProtocol<Commands>,
): Schema {
  const schemasRecord: Record<string, Schema> = {
    error: errorMessageSchema,
  }
  for (const [command, definition] of Object.entries(protocol)) {
    const def = definition as AnyCommandProtocol
    switch (def.type) {
      case 'channel':
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: fallthrough is intentional
      case 'stream':
        schemasRecord[def.receive.$id ?? `${command}:receive`] = createReceiveMessageSchema(def)
      case 'request':
        if (def.result != null) {
          schemasRecord[def.result?.$id ?? `${command}:result`] = createResultMessageSchema(def)
        }
    }
  }
  return { anyOf: Object.values(schemasRecord) } as const satisfies Schema
}

import type { Schema } from '@enkaku/schema'

import { createMessageSchema } from './message.js'
import type {
  AnyCommandDefinition,
  ChannelCommandDefinition,
  ProtocolDefinition,
  RequestCommandDefinition,
  StreamCommandDefinition,
} from './protocol.js'

/** @internal */
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
  additionalProperties: true,
} as const satisfies Schema)

/** @internal */
export function createReceiveMessageSchema(
  definition: StreamCommandDefinition | ChannelCommandDefinition,
): Schema {
  const payloadSchema = {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'receive' },
      rid: { type: 'string' },
      val: definition.receive,
      jti: { type: 'string' },
    },
    required: ['typ', 'rid', 'val'],
    additionalProperties: true,
  } as const satisfies Schema
  return createMessageSchema(payloadSchema)
}

/** @internal */
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
    additionalProperties: true,
  } as const satisfies Schema)
}

/** @internal */
export const resultMessageWithoutValue: Schema = createMessageSchema({
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'result' },
    rid: { type: 'string' },
    jti: { type: 'string' },
  },
  required: ['typ', 'rid'],
  additionalProperties: true,
} as const satisfies Schema)

/** @internal */
export function createResultMessageSchema(
  definition: RequestCommandDefinition | StreamCommandDefinition | ChannelCommandDefinition,
): Schema {
  return definition.result
    ? createResultMessageWithValue(definition.result)
    : resultMessageWithoutValue
}

export function createServerMessageSchema(protocol: ProtocolDefinition): Schema {
  const schemasRecord: Record<string, Schema> = {
    error: errorMessageSchema,
  }
  for (const [command, definition] of Object.entries(protocol)) {
    const def = definition as AnyCommandDefinition
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

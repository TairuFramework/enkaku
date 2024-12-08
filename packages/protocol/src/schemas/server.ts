import type { Schema } from '@enkaku/schema'

import { type MessageType, createMessageSchema } from './message.js'
import type {
  AnyCommandDefinition,
  ChannelCommandDefinition,
  ProtocolDefinition,
  RequestCommandDefinition,
  StreamCommandDefinition,
} from './protocol.js'

/** @internal */
export const errorMessagePayload: Schema = {
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
} as const satisfies Schema

/** @internal */
export function createErrorMessageSchema(type?: MessageType): Schema {
  return createMessageSchema(errorMessagePayload, type)
}

/** @internal */
export function createReceiveMessageSchema(
  definition: StreamCommandDefinition | ChannelCommandDefinition,
  type?: MessageType,
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
  return createMessageSchema(payloadSchema, type)
}

/** @internal */
export function createResultMessageWithValueSchema(
  valueSchema: Schema,
  type?: MessageType,
): Schema {
  return createMessageSchema(
    {
      type: 'object',
      properties: {
        typ: { type: 'string', const: 'result' },
        rid: { type: 'string' },
        val: valueSchema,
        jti: { type: 'string' },
      },
      required: ['typ', 'rid', 'val'],
      additionalProperties: true,
    } as const satisfies Schema,
    type,
  )
}

/** @internal */
export const resultMessageWithoutValuePayload = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'result' },
    rid: { type: 'string' },
    jti: { type: 'string' },
  },
  required: ['typ', 'rid'],
  additionalProperties: true,
} as const satisfies Schema

/** @internal */
export function createResultMessageWithoutValueSchema(type?: MessageType): Schema {
  return createMessageSchema(resultMessageWithoutValuePayload, type)
}

/** @internal */
export function createResultMessageSchema(
  definition: RequestCommandDefinition | StreamCommandDefinition | ChannelCommandDefinition,
  type?: MessageType,
): Schema {
  return definition.result
    ? createResultMessageWithValueSchema(definition.result, type)
    : createResultMessageWithoutValueSchema(type)
}

export function createServerMessageSchema(
  protocol: ProtocolDefinition,
  type?: MessageType,
): Schema {
  const schemasRecord: Record<string, Schema> = {
    error: createErrorMessageSchema(type),
  }
  for (const [command, definition] of Object.entries(protocol)) {
    const def = definition as AnyCommandDefinition
    switch (def.type) {
      case 'channel':
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: fallthrough is intentional
      case 'stream':
        schemasRecord[def.receive.$id ?? `${command}:receive`] = createReceiveMessageSchema(
          def,
          type,
        )
      case 'request':
        if (def.result != null) {
          schemasRecord[def.result?.$id ?? `${command}:result`] = createResultMessageSchema(
            def,
            type,
          )
        }
    }
  }
  return { anyOf: Object.values(schemasRecord) } as const satisfies Schema
}

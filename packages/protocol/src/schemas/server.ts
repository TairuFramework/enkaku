import { rebaseDefinitionReferences, type Schema } from '@sozai/schema'

import { createMessageSchema, type MessageType } from './message.js'
import type {
  AnyProcedureDefinition,
  ChannelProcedureDefinition,
  ProtocolDefinition,
  RequestProcedureDefinition,
  StreamProcedureDefinition,
} from './protocol.js'

/** @internal */
export const errorMessagePayload: Schema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'error' },
    rid: { type: 'string', maxLength: 128 },
    code: { type: 'string', maxLength: 128 },
    msg: { type: 'string', maxLength: 4096 },
    data: { type: 'object', maxProperties: 64 },
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'rid', 'code', 'msg'],
  additionalProperties: false,
} as const satisfies Schema

/** @internal */
export function createErrorMessageSchema(type?: MessageType): Schema {
  return createMessageSchema(errorMessagePayload, type)
}

/** @internal */
export function createReceiveMessageSchema(
  definition: StreamProcedureDefinition | ChannelProcedureDefinition,
  type?: MessageType,
): Schema {
  const payloadSchema = {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'receive' },
      rid: { type: 'string', maxLength: 128 },
      val: definition.receive,
      jti: { type: 'string', maxLength: 128 },
    },
    required: ['typ', 'rid', 'val'],
    additionalProperties: false,
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
        rid: { type: 'string', maxLength: 128 },
        val: valueSchema,
        jti: { type: 'string', maxLength: 128 },
      },
      required: ['typ', 'rid', 'val'],
      additionalProperties: false,
    } as const satisfies Schema,
    type,
  )
}

/** @internal */
export const resultMessageWithoutValuePayload = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'result' },
    rid: { type: 'string', maxLength: 128 },
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'rid'],
  additionalProperties: false,
} as const satisfies Schema

/** @internal */
export function createResultMessageWithoutValueSchema(type?: MessageType): Schema {
  return createMessageSchema(resultMessageWithoutValuePayload, type)
}

/** @internal */
export function createResultMessageSchema(
  definition: RequestProcedureDefinition | StreamProcedureDefinition | ChannelProcedureDefinition,
  type?: MessageType,
): Schema {
  return definition.result
    ? createResultMessageWithValueSchema(definition.result, type)
    : createResultMessageWithoutValueSchema(type)
}

// Keyed by protocol object so createValidator()'s schema-identity cache hits across callers.
const serverMessageSchemas = new WeakMap<ProtocolDefinition, Map<MessageType, Schema>>()

/**
 * Memoized per protocol object and message type: callers get the same schema instance.
 * Do not mutate the returned schema or the protocol after first use.
 */
export function createServerMessageSchema(
  protocol: ProtocolDefinition,
  type: MessageType = 'any',
): Schema {
  let byType = serverMessageSchemas.get(protocol)
  if (byType == null) {
    byType = new Map()
    serverMessageSchemas.set(protocol, byType)
  }
  const cached = byType.get(type)
  if (cached != null) {
    return cached
  }
  const schemasRecord: Record<string, Schema> = {
    error: createErrorMessageSchema(type),
  }
  for (const [procedure, definition] of Object.entries(protocol)) {
    const def = definition as AnyProcedureDefinition
    switch (def.type) {
      case 'channel':
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: fallthrough is intentional
      case 'stream':
        schemasRecord[def.receive.$id ?? `${procedure}:receive`] = createReceiveMessageSchema(
          def,
          type,
        )
      case 'request':
        if (def.result != null) {
          schemasRecord[def.result?.$id ?? `${procedure}:result`] = createResultMessageSchema(
            def,
            type,
          )
        }
    }
  }
  const schema = rebaseDefinitionReferences({ anyOf: Object.values(schemasRecord) })
  byType.set(type, schema)
  return schema
}

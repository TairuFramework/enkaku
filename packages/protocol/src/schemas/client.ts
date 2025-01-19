import type { Schema } from '@enkaku/schema'

import { type MessageType, createMessageSchema } from './message.js'
import type {
  AnyProcedureDefinition,
  AnyRequestProcedureDefinition,
  ChannelProcedureDefinition,
  EventProcedureDefinition,
  ProtocolDefinition,
  RequestType,
} from './protocol.js'

/** @internal */
export const abortMessagePayload: Schema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'abort' },
    rid: { type: 'string' },
    jti: { type: 'string' },
    rsn: { type: 'string' },
  },
  required: ['typ', 'rid'],
  additionalProperties: true,
} as const satisfies Schema

/** @internal */
export function createAbortMessageSchema(type?: MessageType): Schema {
  return createMessageSchema(abortMessagePayload, type)
}

/** @internal */
export function createEventPayloadWithData(procedure: string, dataSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'event' },
      prc: { type: 'string', const: procedure },
      data: dataSchema,
      jti: { type: 'string' },
    },
    required: ['typ', 'prc', 'data'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createEventPayloadWithoutData(procedure: string): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'event' },
      prc: { type: 'string', const: procedure },
      jti: { type: 'string' },
    },
    required: ['typ', 'prc'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createEventMessageSchema(
  procedure: string,
  definition: EventProcedureDefinition,
  type?: MessageType,
): Schema {
  const payload = definition.data
    ? createEventPayloadWithData(procedure, definition.data)
    : createEventPayloadWithoutData(procedure)
  return createMessageSchema(payload, type)
}

/** @internal */
export function createRequestPayloadWithParam(
  procedure: string,
  type: RequestType,
  paramSchema: Schema,
): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: type },
      prc: { type: 'string', const: procedure },
      rid: { type: 'string' },
      prm: paramSchema,
      jti: { type: 'string' },
    },
    required: ['typ', 'prc', 'rid', 'prm'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createRequestPayloadWithoutParam(procedure: string, type: RequestType): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: type },
      prc: { type: 'string', const: procedure },
      rid: { type: 'string' },
      jti: { type: 'string' },
    },
    required: ['typ', 'prc', 'rid'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createRequestMessageSchema(
  procedure: string,
  definition: AnyRequestProcedureDefinition,
  type?: MessageType,
): Schema {
  const payload = definition.param
    ? createRequestPayloadWithParam(procedure, definition.type, definition.param)
    : createRequestPayloadWithoutParam(procedure, definition.type)
  return createMessageSchema(payload, type)
}

/** @internal */
export function createSendMessageSchema(
  procedure: string,
  definition: ChannelProcedureDefinition,
  type?: MessageType,
): Schema {
  const payloadSchema = {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'send' },
      prc: { type: 'string', const: procedure },
      rid: { type: 'string' },
      val: definition.send,
      jti: { type: 'string' },
    },
    required: ['typ', 'prc', 'rid', 'val'],
    additionalProperties: true,
  } as const satisfies Schema
  return createMessageSchema(payloadSchema, type)
}

export function createClientMessageSchema(
  protocol: ProtocolDefinition,
  type?: MessageType,
): Schema {
  let addAbort = false
  const schemasRecord: Record<string, Schema> = {}
  for (const [procedure, definition] of Object.entries(protocol)) {
    const def = definition as AnyProcedureDefinition
    switch (def.type) {
      case 'event':
        if (def.data != null) {
          schemasRecord[def.data?.$id ?? `${procedure}:data`] = createEventMessageSchema(
            procedure,
            def,
            type,
          )
        }
        break
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: fallthrough is intentional
      case 'channel':
        schemasRecord[def.send.$id ?? `${procedure}:send`] = createSendMessageSchema(
          procedure,
          def,
          type,
        )
      case 'request':
      case 'stream':
        addAbort = true
        schemasRecord[def.param?.$id ?? `${procedure}:param`] = createRequestMessageSchema(
          procedure,
          def,
          type,
        )
    }
  }
  if (addAbort) {
    schemasRecord.abort = createAbortMessageSchema(type)
  }
  return { anyOf: Object.values(schemasRecord) } as const satisfies Schema
}

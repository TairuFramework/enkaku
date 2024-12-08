import type { Schema } from '@enkaku/schema'

import { type MessageType, createMessageSchema } from './message.js'
import type {
  AnyCommandDefinition,
  AnyRequestCommandDefinition,
  ChannelCommandDefinition,
  EventCommandDefinition,
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
  },
  required: ['typ', 'rid'],
  additionalProperties: true,
} as const satisfies Schema

/** @internal */
export function createAbortMessageSchema(type?: MessageType): Schema {
  return createMessageSchema(abortMessagePayload, type)
}

/** @internal */
export function createEventPayloadWithData(command: string, dataSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'event' },
      cmd: { type: 'string', const: command },
      data: dataSchema,
      jti: { type: 'string' },
    },
    required: ['typ', 'cmd', 'data'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createEventPayloadWithoutData(command: string): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'event' },
      cmd: { type: 'string', const: command },
      jti: { type: 'string' },
    },
    required: ['typ', 'cmd'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createEventMessageSchema(
  command: string,
  definition: EventCommandDefinition,
  type?: MessageType,
): Schema {
  const payload = definition.data
    ? createEventPayloadWithData(command, definition.data)
    : createEventPayloadWithoutData(command)
  return createMessageSchema(payload, type)
}

/** @internal */
export function createRequestPayloadWithParams(
  command: string,
  type: RequestType,
  paramsSchema: Schema,
): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: type },
      cmd: { type: 'string', const: command },
      rid: { type: 'string' },
      prm: paramsSchema,
      jti: { type: 'string' },
    },
    required: ['typ', 'cmd', 'rid', 'prm'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createRequestPayloadWithoutParams(command: string, type: RequestType): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: type },
      cmd: { type: 'string', const: command },
      rid: { type: 'string' },
      jti: { type: 'string' },
    },
    required: ['typ', 'cmd', 'rid'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createRequestMessageSchema(
  command: string,
  definition: AnyRequestCommandDefinition,
  type?: MessageType,
): Schema {
  const payload = definition.params
    ? createRequestPayloadWithParams(command, definition.type, definition.params)
    : createRequestPayloadWithoutParams(command, definition.type)
  return createMessageSchema(payload, type)
}

/** @internal */
export function createSendMessageSchema(
  command: string,
  definition: ChannelCommandDefinition,
  type?: MessageType,
): Schema {
  const payloadSchema = {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'send' },
      cmd: { type: 'string', const: command },
      rid: { type: 'string' },
      val: definition.send,
      jti: { type: 'string' },
    },
    required: ['typ', 'cmd', 'rid', 'val'],
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
  for (const [command, definition] of Object.entries(protocol)) {
    const def = definition as AnyCommandDefinition
    switch (def.type) {
      case 'event':
        if (def.data != null) {
          schemasRecord[def.data?.$id ?? `${command}:data`] = createEventMessageSchema(
            command,
            def,
            type,
          )
        }
        break
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: fallthrough is intentional
      case 'channel':
        schemasRecord[def.send.$id ?? `${command}:send`] = createSendMessageSchema(
          command,
          def,
          type,
        )
      case 'request':
      case 'stream':
        addAbort = true
        schemasRecord[def.params?.$id ?? `${command}:params`] = createRequestMessageSchema(
          command,
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

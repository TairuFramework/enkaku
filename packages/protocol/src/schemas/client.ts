import type { Schema } from '@enkaku/schema'

import type { RequestType } from '../types/invocations.js'
import type {
  AnyCommandProtocol,
  ChannelCommandProtocol,
  CommandsRecordProtocol,
  EventCommandProtocol,
  RequestCommandProtocol,
  StreamCommandProtocol,
} from '../types/protocol.js'

import { createMessageSchema } from './jwt.js'

export const abortMessageSchema: Schema = createMessageSchema({
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'abort' },
    rid: { type: 'string' },
    jti: { type: 'string' },
  },
  required: ['typ', 'rid'],
  additionalProperties: false,
} as const satisfies Schema)

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
    additionalProperties: false,
  } as const satisfies Schema
}

export function createEventPayloadWithoutData(command: string): Schema {
  return {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'event' },
      cmd: { type: 'string', const: command },
      jti: { type: 'string' },
    },
    required: ['typ', 'cmd'],
    additionalProperties: false,
  } as const satisfies Schema
}

export function createEventMessageSchema(command: string, protocol: EventCommandProtocol): Schema {
  const payload = protocol.data
    ? createEventPayloadWithData(command, protocol.data)
    : createEventPayloadWithoutData(command)
  return createMessageSchema(payload)
}

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
    additionalProperties: false,
  } as const satisfies Schema
}

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
    additionalProperties: false,
  } as const satisfies Schema
}

export function createRequestMessageSchema(
  command: string,
  protocol: RequestCommandProtocol | StreamCommandProtocol | ChannelCommandProtocol,
): Schema {
  const payload = protocol.params
    ? createRequestPayloadWithParams(command, protocol.type, protocol.params)
    : createRequestPayloadWithoutParams(command, protocol.type)
  return createMessageSchema(payload)
}

export function createSendMessageSchema(protocol: ChannelCommandProtocol): Schema {
  const payloadSchema = {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'send' },
      rid: { type: 'string' },
      val: protocol.send,
      jti: { type: 'string' },
    },
    required: ['typ', 'rid', 'val'],
    additionalProperties: false,
  } as const satisfies Schema
  return createMessageSchema(payloadSchema)
}

export function createClientMessageSchema<Commands extends string>(
  protocol: CommandsRecordProtocol<Commands>,
): Schema {
  let addAbort = false
  const schemasRecord: Record<string, Schema> = {}
  for (const [command, definition] of Object.entries(protocol)) {
    const def = definition as AnyCommandProtocol
    switch (def.type) {
      case 'event':
        if (def.data != null) {
          schemasRecord[def.data?.$id ?? `${command}:data`] = createEventMessageSchema(command, def)
        }
        break
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: fallthrough is intentional
      case 'channel':
        schemasRecord[def.send.$id ?? `${command}:send`] = createSendMessageSchema(def)
      case 'request':
      case 'stream':
        addAbort = true
        if (def.params != null) {
          schemasRecord[def.params?.$id ?? `${command}:params`] = createRequestMessageSchema(
            command,
            def,
          )
        }
    }
  }
  if (addAbort) {
    schemasRecord.abort = abortMessageSchema
  }
  return { anyOf: Object.values(schemasRecord) } as const satisfies Schema
}

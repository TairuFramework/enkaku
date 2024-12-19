import type { FromSchema, Schema } from '@enkaku/schema'

export const anyTypeDefinition = {
  type: 'object',
  properties: {
    $id: { type: 'string' },
    type: {
      type: 'string',
      enum: ['array', 'boolean', 'integer', 'null', 'number', 'object', 'string'],
    },
    description: { type: 'string' },
  },
  required: ['type'],
  additionalProperties: true,
} as const satisfies Schema

export const objectTypeDefinition = {
  type: 'object',
  properties: {
    $id: { type: 'string' },
    type: { type: 'string', const: 'object' },
    description: { type: 'string' },
  },
  required: ['type'],
  additionalProperties: true,
} as const satisfies Schema

export const errorObjectDefinition = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'object' },
    properties: {
      type: 'object',
      properties: {
        code: {
          type: 'object',
          properties: { type: { type: 'string', const: 'string' } },
          required: ['type'],
          additionalProperties: true,
        },
        message: {
          type: 'object',
          properties: { type: { type: 'string', const: 'string' } },
          required: ['type'],
          additionalProperties: true,
        },
        data: objectTypeDefinition,
      },
    },
    required: { anyOf: [{ const: ['code', 'message'] }, { const: ['code', 'message', 'data'] }] },
    additionalProperties: { type: 'boolean', const: false },
  },
  required: ['type', 'properties', 'required', 'additionalProperties'],
} as const satisfies Schema
export type ErrorObjectDefinition = FromSchema<typeof errorObjectDefinition>

export const errorDefinition = {
  anyOf: [
    errorObjectDefinition,
    {
      type: 'object',
      properties: { anyOf: { type: 'array', items: errorObjectDefinition, minItems: 1 } },
      required: ['anyOf'],
    },
  ],
} as const satisfies Schema
export type ErrorDefinition = FromSchema<typeof errorDefinition>

export const eventProcedureDefinition = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'event' },
    description: { type: 'string' },
    data: objectTypeDefinition,
  },
  required: ['type'],
  additionalProperties: false,
} as const satisfies Schema
export type EventProcedureDefinition = FromSchema<typeof eventProcedureDefinition>

export const requestProcedureDefinition = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'request' },
    description: { type: 'string' },
    params: anyTypeDefinition,
    result: anyTypeDefinition,
    error: errorObjectDefinition,
  },
  required: ['type'],
  additionalProperties: false,
} as const satisfies Schema
export type RequestProcedureDefinition = FromSchema<typeof requestProcedureDefinition>

export const streamProcedureDefinition = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'stream' },
    description: { type: 'string' },
    params: anyTypeDefinition,
    receive: anyTypeDefinition,
    result: anyTypeDefinition,
    error: errorObjectDefinition,
  },
  required: ['type', 'receive'],
  additionalProperties: false,
} as const satisfies Schema
export type StreamProcedureDefinition = FromSchema<typeof streamProcedureDefinition>

export const channelProcedureDefinition = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'channel' },
    description: { type: 'string' },
    params: anyTypeDefinition,
    send: anyTypeDefinition,
    receive: anyTypeDefinition,
    result: anyTypeDefinition,
    error: errorObjectDefinition,
  },
  required: ['type', 'send', 'receive'],
  additionalProperties: false,
} as const satisfies Schema
export type ChannelProcedureDefinition = FromSchema<typeof channelProcedureDefinition>

export const anyRequestProcedureDefinition = {
  anyOf: [requestProcedureDefinition, streamProcedureDefinition, channelProcedureDefinition],
} as const satisfies Schema
export type AnyRequestProcedureDefinition = FromSchema<typeof anyRequestProcedureDefinition>

export type RequestType = AnyRequestProcedureDefinition['type']

export const anyProcedureDefinition = {
  anyOf: [
    eventProcedureDefinition,
    requestProcedureDefinition,
    streamProcedureDefinition,
    channelProcedureDefinition,
  ],
} as const satisfies Schema
export type AnyProcedureDefinition = FromSchema<typeof anyProcedureDefinition>

export const protocolDefinition = {
  type: 'object',
  additionalProperties: anyProcedureDefinition,
} as const satisfies Schema
export type ProtocolDefinition = FromSchema<typeof protocolDefinition>

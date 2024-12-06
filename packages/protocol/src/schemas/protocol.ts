import type { FromSchema, Schema } from '@enkaku/schema'

export const anyTypeDefinition = {
  type: 'object',
  properties: {
    $id: { type: 'string' },
    type: {
      type: 'string',
      enum: ['array', 'boolean', 'integer', 'null', 'number', 'object', 'string'],
    },
  },
  required: ['type'],
  additionalProperties: true,
} as const satisfies Schema

export const objectTypeDefinition = {
  type: 'object',
  properties: {
    $id: { type: 'string' },
    type: { type: 'string', const: 'object' },
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

export const eventCommandDefinition = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'event' },
    description: { type: 'string' },
    data: objectTypeDefinition,
  },
  required: ['type'],
  additionalProperties: false,
} as const satisfies Schema
export type EventCommandDefinition = FromSchema<typeof eventCommandDefinition>

export const requestCommandDefinition = {
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
export type RequestCommandDefinition = FromSchema<typeof requestCommandDefinition>

export const streamCommandDefinition = {
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
export type StreamCommandDefinition = FromSchema<typeof streamCommandDefinition>

export const channelCommandDefinition = {
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
export type ChannelCommandDefinition = FromSchema<typeof channelCommandDefinition>

export const anyRequestCommandDefinition = {
  anyOf: [requestCommandDefinition, streamCommandDefinition, channelCommandDefinition],
} as const satisfies Schema
export type AnyRequestCommandDefinition = FromSchema<typeof anyRequestCommandDefinition>

export type RequestType = AnyRequestCommandDefinition['type']

export const anyCommandDefinition = {
  anyOf: [
    eventCommandDefinition,
    requestCommandDefinition,
    streamCommandDefinition,
    channelCommandDefinition,
  ],
} as const satisfies Schema
export type AnyCommandDefinition = FromSchema<typeof anyCommandDefinition>

export const protocolDefinition = {
  type: 'object',
  additionalProperties: anyCommandDefinition,
} as const satisfies Schema
export type ProtocolDefinition = FromSchema<typeof protocolDefinition>

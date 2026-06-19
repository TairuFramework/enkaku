import type { ProtocolDefinition } from '@enkaku/protocol'

export const hubProtocol = {
  'hub/publish': {
    type: 'request',
    description: 'Publish an opaque message to a topic; fans out to current subscribers',
    param: {
      type: 'object',
      properties: {
        topicID: { type: 'string', minLength: 1, maxLength: 256 },
        payload: { type: 'string', contentEncoding: 'base64', maxLength: 1048576 },
      },
      required: ['topicID', 'payload'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        sequenceID: { type: 'string' },
      },
      required: ['sequenceID'],
      additionalProperties: false,
    },
  },
  'hub/subscribe': {
    type: 'request',
    description: 'Subscribe to a topic, creating a durable inbox for the caller',
    param: {
      type: 'object',
      properties: {
        topicID: { type: 'string', minLength: 1, maxLength: 256 },
      },
      required: ['topicID'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        subscribed: { type: 'boolean' },
      },
      required: ['subscribed'],
      additionalProperties: false,
    },
  },
  'hub/unsubscribe': {
    type: 'request',
    description: "Unsubscribe from a topic, dropping the caller's inbox for it",
    param: {
      type: 'object',
      properties: {
        topicID: { type: 'string', minLength: 1, maxLength: 256 },
      },
      required: ['topicID'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        unsubscribed: { type: 'boolean' },
      },
      required: ['unsubscribed'],
      additionalProperties: false,
    },
  },
  'hub/receive': {
    type: 'channel',
    description:
      'Bidirectional mailbox channel — hub pushes messages across all subscribed topics, device pushes acks',
    param: {
      type: 'object',
      properties: {
        after: { type: 'string', maxLength: 64 },
      },
      additionalProperties: false,
    },
    send: {
      type: 'object',
      properties: {
        ack: {
          type: 'array',
          items: { type: 'string', maxLength: 64 },
          maxItems: 1000,
        },
      },
      required: ['ack'],
      additionalProperties: false,
    },
    receive: {
      type: 'object',
      properties: {
        sequenceID: { type: 'string' },
        senderDID: { type: 'string' },
        topicID: { type: 'string' },
        payload: { type: 'string', contentEncoding: 'base64' },
      },
      required: ['sequenceID', 'senderDID', 'topicID', 'payload'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  'hub/keypackage/upload': {
    type: 'request',
    description: 'Upload key packages for later retrieval',
    param: {
      type: 'object',
      properties: {
        keyPackages: {
          type: 'array',
          items: { type: 'string', maxLength: 16384 },
          minItems: 1,
          maxItems: 50,
        },
      },
      required: ['keyPackages'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        stored: { type: 'integer' },
      },
      required: ['stored'],
      additionalProperties: false,
    },
  },
  'hub/keypackage/fetch': {
    type: 'request',
    description: 'Fetch and consume key packages for a DID',
    param: {
      type: 'object',
      properties: {
        did: { type: 'string', minLength: 1, maxLength: 256 },
        count: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['did'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        keyPackages: { type: 'array', items: { type: 'string' } },
      },
      required: ['keyPackages'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition

export type HubProtocol = typeof hubProtocol

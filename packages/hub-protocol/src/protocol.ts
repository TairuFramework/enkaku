import type { ProtocolDefinition } from '@enkaku/protocol'

export const hubProtocol = {
  'hub/send': {
    type: 'request',
    description: 'Send opaque message to explicit recipients',
    param: {
      type: 'object',
      properties: {
        recipients: {
          type: 'array',
          items: { type: 'string', maxLength: 256 },
          minItems: 1,
          maxItems: 100,
        },
        payload: { type: 'string', contentEncoding: 'base64', maxLength: 1048576 },
      },
      required: ['recipients', 'payload'],
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
  'hub/group/send': {
    type: 'request',
    description: 'Send opaque message to all members of a group',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string', minLength: 1, maxLength: 128 },
        payload: { type: 'string', contentEncoding: 'base64', maxLength: 1048576 },
      },
      required: ['groupID', 'payload'],
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
  'hub/receive': {
    type: 'channel',
    description: 'Bidirectional mailbox channel — hub pushes messages, device pushes acks',
    param: {
      type: 'object',
      properties: {
        after: { type: 'string', maxLength: 64 },
        groupIDs: {
          type: 'array',
          items: { type: 'string', maxLength: 128 },
          maxItems: 100,
        },
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
        groupID: { type: 'string' },
        payload: { type: 'string', contentEncoding: 'base64' },
      },
      required: ['sequenceID', 'senderDID', 'payload'],
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
  'hub/group/join': {
    type: 'request',
    description: 'Register as a member of a group on the hub',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string', minLength: 1, maxLength: 128 },
        credential: { type: 'string', minLength: 1, maxLength: 16384 },
        delegationChain: {
          type: 'array',
          items: { type: 'string', maxLength: 16384 },
          maxItems: 10,
        },
      },
      required: ['groupID', 'credential'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        joined: { type: 'boolean' },
      },
      required: ['joined'],
      additionalProperties: false,
    },
  },
  'hub/group/leave': {
    type: 'request',
    description: 'Unregister from a group on the hub',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string', minLength: 1, maxLength: 128 },
      },
      required: ['groupID'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        left: { type: 'boolean' },
      },
      required: ['left'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition

export type HubProtocol = typeof hubProtocol

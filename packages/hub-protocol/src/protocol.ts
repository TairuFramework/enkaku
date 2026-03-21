import type { ProtocolDefinition } from '@enkaku/protocol'

/**
 * Hub protocol definition for group-aware message routing.
 *
 * All messages are standard Enkaku procedure types:
 * - hub/send: request (send encrypted message to a group)
 * - hub/receive: stream (server pushes messages to client)
 * - hub/tunnel/request: channel (bidirectional tunnel between peers)
 * - hub/keypackage/upload: request (upload key packages)
 * - hub/keypackage/fetch: request (fetch key packages for a DID)
 * - hub/group/join: request (announce group membership)
 * - hub/group/leave: request (leave a group)
 */
export const hubProtocol = {
  'hub/send': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string' },
        epoch: { type: 'integer' },
        contentType: {
          type: 'string',
          enum: ['commit', 'proposal', 'welcome', 'application'],
        },
        payload: { type: 'string' },
      },
      required: ['groupID', 'epoch', 'contentType', 'payload'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        delivered: { type: 'integer' },
        queued: { type: 'integer' },
      },
      required: ['delivered', 'queued'],
      additionalProperties: false,
    },
  },
  'hub/receive': {
    type: 'stream',
    param: {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['groups'],
      additionalProperties: false,
    },
    receive: {
      type: 'object',
      properties: {
        senderDID: { type: 'string' },
        groupID: { type: 'string' },
        epoch: { type: 'integer' },
        contentType: {
          type: 'string',
          enum: ['commit', 'proposal', 'welcome', 'application'],
        },
        payload: { type: 'string' },
      },
      required: ['senderDID', 'groupID', 'epoch', 'contentType', 'payload'],
      additionalProperties: false,
    },
  },
  'hub/tunnel/request': {
    type: 'channel',
    param: {
      type: 'object',
      properties: {
        peerDID: { type: 'string' },
        groupID: { type: 'string' },
      },
      required: ['peerDID', 'groupID'],
      additionalProperties: false,
    },
    send: {
      type: 'object',
      properties: {
        data: { type: 'string' },
      },
      required: ['data'],
      additionalProperties: false,
    },
    receive: {
      type: 'object',
      properties: {
        data: { type: 'string' },
      },
      required: ['data'],
      additionalProperties: false,
    },
  },
  'hub/keypackage/upload': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        keyPackages: {
          type: 'array',
          items: { type: 'string' },
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
    param: {
      type: 'object',
      properties: {
        did: { type: 'string' },
        count: { type: 'integer' },
      },
      required: ['did'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        keyPackages: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['keyPackages'],
      additionalProperties: false,
    },
  },
  'hub/group/join': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string' },
        credential: { type: 'string' },
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
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string' },
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

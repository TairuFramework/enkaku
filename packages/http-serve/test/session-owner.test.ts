import { Server } from '@enkaku/server'
import { createUnsignedToken, randomIdentity } from '@kokuin/token'
import { describe, expect, test } from 'vitest'

import { createServerBridge, type HTTPMessageContext, ServerTransport } from '../src/index.js'

const OWNER = 'did:key:owner'
const FOREIGN = 'did:key:foreign'

function post(typ: string, rid: string, iss?: string, sessionID?: string): Request {
  return new Request('http://localhost/rpc', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(sessionID == null ? {} : { 'enkaku-session-id': sessionID }),
    },
    body: JSON.stringify(createUnsignedToken({ payload: { typ, rid, iss, prc: 'watch' } })),
  })
}

async function setup(enforceSessionOwner?: boolean, typ = 'channel') {
  const bridge = createServerBridge({
    enforceSessionOwner,
    heartbeatIntervalMs: 0,
    requestTimeoutMs: 50,
  })
  const reader = bridge.stream.readable.getReader()
  const response = await bridge.handleRequest(post(typ, 'initial', OWNER))
  const { value } = await reader.read()
  const session = bridge.getMessageContext(value)?.session
  return {
    bridge,
    reader,
    session,
    sessionID: response.headers.get('enkaku-session-id') as string,
    close() {
      bridge.dispose()
      reader.releaseLock()
    },
  }
}

describe('HTTP session owner', () => {
  test.each(['stream', 'channel'])('bindOwner sets owner on new %s session', async (typ) => {
    const fixture = await setup(undefined, typ)
    try {
      expect(fixture.session).toBeDefined()
      expect(fixture.session?.id).toBe(fixture.sessionID)
      expect(fixture.session?.owner).toBeUndefined()
      fixture.session?.bindOwner(OWNER)
      expect(fixture.session?.owner).toBe(OWNER)
      expect(() => fixture.session?.bindOwner(OWNER)).not.toThrow()
    } finally {
      fixture.close()
    }
  })

  test('rebinding to another DID throws', async () => {
    const fixture = await setup()
    try {
      fixture.session?.bindOwner(OWNER)
      expect(() => fixture.session?.bindOwner(FOREIGN)).toThrow()
      expect(fixture.session?.owner).toBe(OWNER)
    } finally {
      fixture.close()
    }
  })

  test.each(['stream', 'channel', 'send', 'abort', 'event', 'request'])(
    'rejects foreign iss on bound session for %s without enqueueing',
    async (typ) => {
      const fixture = await setup()
      try {
        fixture.session?.bindOwner(OWNER)
        const response = await fixture.bridge.handleRequest(
          post(typ, 'foreign', FOREIGN, fixture.sessionID),
        )
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Session owner mismatch' })
        await fixture.bridge.handleRequest(post('event', 'sentinel'))
        expect((await fixture.reader.read()).value?.payload).toMatchObject({ rid: 'sentinel' })
      } finally {
        fixture.close()
      }
    },
  )

  test('rejects missing iss on bound session', async () => {
    const fixture = await setup()
    try {
      fixture.session?.bindOwner(OWNER)
      expect(
        (await fixture.bridge.handleRequest(post('send', 'missing', undefined, fixture.sessionID)))
          .status,
      ).toBe(403)
    } finally {
      fixture.close()
    }
  })

  test.each(['stream', 'channel', 'send', 'abort', 'event', 'request'])(
    'accepts owner iss on bound session and shares handle for %s',
    async (typ) => {
      const fixture = await setup()
      try {
        fixture.session?.bindOwner(OWNER)
        const response = fixture.bridge.handleRequest(post(typ, 'owner', OWNER, fixture.sessionID))
        const { value } = await fixture.reader.read()
        expect(value?.payload).toMatchObject({ rid: 'owner' })
        expect(fixture.bridge.getMessageContext(value)?.session).toBe(fixture.session)
        expect(fixture.bridge.getMessageContext(value)?.session?.owner).toBe(OWNER)
        fixture.bridge.dispose()
        expect((await response).status).toBe(typ === 'request' ? 503 : 204)
      } finally {
        fixture.close()
      }
    },
  )

  test('unbound session unchanged', async () => {
    const fixture = await setup()
    try {
      expect(fixture.session).toBeDefined()
      expect(
        (await fixture.bridge.handleRequest(post('channel', 'foreign', FOREIGN, fixture.sessionID)))
          .status,
      ).toBe(204)
      expect((await fixture.reader.read()).value?.payload).toMatchObject({ iss: FOREIGN })
      expect(fixture.session?.owner).toBeUndefined()
    } finally {
      fixture.close()
    }
  })

  test('enforceSessionOwner false disables check', async () => {
    const fixture = await setup(false)
    try {
      fixture.session?.bindOwner(OWNER)
      expect(fixture.session?.owner).toBe(OWNER)
      expect(
        (await fixture.bridge.handleRequest(post('send', 'foreign', FOREIGN, fixture.sessionID)))
          .status,
      ).toBe(204)
      expect((await fixture.reader.read()).value?.payload).toMatchObject({ iss: FOREIGN })
    } finally {
      fixture.close()
    }
  })

  test('onInvocation binds session owner from verified caller.iss', async () => {
    const protocol = {
      watch: {
        type: 'stream',
        param: { type: 'null' },
        receive: { type: 'string' },
        result: { type: 'null' },
      },
    } as const
    const identity = randomIdentity()
    const caller = randomIdentity()
    const transport = new ServerTransport<typeof protocol>()
    const seen = Promise.withResolvers<HTTPMessageContext | undefined>()
    const server = new Server({
      protocol,
      identity,
      accessRules: { watch: { allow: true } },
      handlers: { watch: () => null },
      onInvocation(ctx) {
        const context = ctx.transport as HTTPMessageContext | undefined
        if (ctx.caller != null) context?.session?.bindOwner(ctx.caller.iss)
        seen.resolve(context)
      },
    })
    server.handle(transport)
    try {
      const token = await caller.signToken({
        payload: {
          typ: 'stream',
          prc: 'watch',
          rid: 'signed',
          prm: null,
          iss: caller.id,
          aud: identity.id,
          iat: Math.floor(Date.now() / 1000),
        } as const,
      })
      const response = await transport.fetch(
        new Request('http://localhost/rpc', {
          method: 'POST',
          body: JSON.stringify(token),
        }),
      )
      const context = await seen.promise
      expect(context?.session?.owner).toBe(caller.id)
      expect(context?.session?.id).toBe(response.headers.get('enkaku-session-id'))
      const rejected = await transport.fetch(post('send', 'foreign', FOREIGN, context?.session?.id))
      expect(rejected.status).toBe(403)
    } finally {
      await server.dispose()
      await transport.dispose()
    }
  })
})

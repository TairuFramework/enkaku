import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createCapability } from '@kokuin/capability'
import { randomIdentity, stringifyToken } from '@kokuin/token'
import { defer } from '@sozai/async'
import { expect, test, vi } from 'vitest'

import type { AccessRules, InvocationContext, ProcedureHandlers } from '../src/index.js'
import { InvocationRejectedError, Server } from '../src/index.js'

const protocol = {
  ping: { type: 'request', param: { type: 'null' }, result: { type: 'string' } },
  notify: { type: 'event', data: { type: 'object' } },
  watch: {
    type: 'stream',
    param: { type: 'null' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
  chat: {
    type: 'channel',
    param: { type: 'null' },
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const

function setup(params: {
  onInvocation: (ctx: InvocationContext) => void | Promise<void>
  auth?: boolean
  accessRules?: AccessRules
  handlers?: Partial<ProcedureHandlers<typeof protocol>>
}) {
  const identity = randomIdentity()
  const caller = randomIdentity()
  const transports = new DirectTransports<
    AnyServerMessageOf<typeof protocol>,
    AnyClientMessageOf<typeof protocol>
  >()
  const handler = vi.fn(() => 'pong')
  const server = new Server<typeof protocol>({
    protocol,
    handlers: {
      ping: handler,
      notify: () => {},
      watch: () => 'done',
      chat: () => 'done',
      ...params.handlers,
    },
    onInvocation: params.onInvocation,
    ...(params.auth === false
      ? { requireAuth: false as const }
      : { identity, accessRules: params.accessRules ?? { ping: { allow: true } } }),
  })
  async function call(extra: Record<string, unknown> = {}) {
    const message = await caller.signToken({
      payload: {
        iss: caller.id,
        typ: 'request',
        prm: null,
        prc: 'ping',
        rid: crypto.randomUUID(),
        aud: identity.id,
        iat: Math.floor(Date.now() / 1000),
        ...extra,
      } as const,
    })
    await transports.client.write(message)
    return { message, response: (await transports.client.read()).value?.payload }
  }
  return { identity, caller, transports, handler, server, call }
}

test('hook sees verified caller and procedure and transport context before handler', async () => {
  const seen: Array<InvocationContext> = []
  const fixture = setup({
    onInvocation: (ctx) => {
      expect(fixture.handler).not.toHaveBeenCalled()
      seen.push(ctx)
    },
  })
  const transportContext = { request: new Request('https://example.com/rpc') }
  const transport = Object.assign(fixture.transports.server, {
    getMessageContext: () => transportContext,
  })
  fixture.server.handle(transport)
  try {
    const { message, response } = await fixture.call()
    expect(response).toMatchObject({ typ: 'result', val: 'pong' })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      type: 'request',
      procedure: 'ping',
      rid: message.payload.rid,
      caller: { iss: fixture.caller.id },
    })
    expect(seen[0]?.transport).toBe(transportContext)
    expect(seen[0]?.message).toBe(message)
    expect(await seen[0]?.verifyDelegation()).toBe(false)
  } finally {
    await fixture.server.dispose()
    await fixture.transports.dispose()
  }
})

test.each([false, true])(
  'hook rejection skips handler and emits invocation error (unexpected=%s)',
  async (unexpected) => {
    const cause = unexpected
      ? new Error('secret detail')
      : new InvocationRejectedError({ code: 'APP_DENIED', message: 'Denied here' })
    const fixture = setup({
      onInvocation: () => {
        throw cause
      },
    })
    const errors = vi.fn()
    fixture.server.events.on('handlerError', errors)
    fixture.server.handle(fixture.transports.server)
    try {
      const { response } = await fixture.call()
      expect(response).toMatchObject({ typ: 'error', code: unexpected ? 'EK01' : 'APP_DENIED' })
      expect(response).toMatchObject({ msg: unexpected ? 'Invocation hook failed' : 'Denied here' })
      expect(fixture.handler).not.toHaveBeenCalled()
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'invocation', messageType: 'request' }),
      )
    } finally {
      await fixture.server.dispose()
      await fixture.transports.dispose()
    }
  },
)

test('non-auth mode hook has no caller and no delegation', async () => {
  const hook = vi.fn(async (ctx: InvocationContext) => {
    expect(ctx.caller).toBeUndefined()
    expect(await ctx.verifyDelegation()).toBe(false)
  })
  const fixture = setup({ auth: false, onInvocation: hook })
  fixture.server.handle(fixture.transports.server)
  try {
    expect((await fixture.call()).response).toMatchObject({ typ: 'result' })
    expect(hook).toHaveBeenCalledTimes(1)
  } finally {
    await fixture.server.dispose()
    await fixture.transports.dispose()
  }
})

test('per-transport hook overrides server hook', async () => {
  const hook = vi.fn()
  const override = vi.fn()
  const fixture = setup({ onInvocation: hook })
  fixture.server.handle(fixture.transports.server, { onInvocation: override })
  try {
    await fixture.call()
    expect(override).toHaveBeenCalledTimes(1)
    expect(hook).not.toHaveBeenCalled()
  } finally {
    await fixture.server.dispose()
    await fixture.transports.dispose()
  }
})

test.each(['valid', 'missing', 'self', 'wrong-procedure', 'wrong-resource'] as const)(
  'delegation proof: %s, shared with access predicate',
  async (proof) => {
    const subject = randomIdentity()
    const checks: Array<boolean> = []
    const hook = vi.fn(async (ctx: InvocationContext) => {
      checks.push(...(await Promise.all([ctx.verifyDelegation(), ctx.verifyDelegation()])))
    })
    const fixture = setup({
      onInvocation: hook,
      accessRules: {
        ping: {
          allow: async (ctx) => {
            checks.push(await ctx.verifyDelegation())
            return true
          },
        },
      },
    })
    const verifyToken = vi.fn()
    fixture.server.handle(fixture.transports.server, { verifyToken })
    const capability = await createCapability({
      signer: subject,
      payload: {
        aud: fixture.caller.id,
        sub: subject.id,
        act: proof === 'wrong-procedure' ? 'other' : 'ping',
        res: proof === 'wrong-resource' ? subject.id : fixture.identity.id,
      },
    })
    try {
      await fixture.call({
        sub: proof === 'self' ? fixture.caller.id : subject.id,
        ...(proof === 'missing' ? {} : { cap: stringifyToken(capability) }),
      })
      expect(checks).toEqual([proof === 'valid', proof === 'valid', proof === 'valid'])
      expect(hook).toHaveBeenCalledTimes(1)
      if (proof === 'valid') expect(verifyToken).toHaveBeenCalledTimes(1)
    } finally {
      await fixture.server.dispose()
      await fixture.transports.dispose()
    }
  },
)

test.each(['request', 'stream', 'channel', 'event'] as const)(
  '%s rejection reports invocation error without starting a handler',
  async (type) => {
    const contexts: Array<InvocationContext> = []
    const fixture = setup({
      auth: false,
      onInvocation: async (ctx) => {
        contexts.push(ctx)
        throw new InvocationRejectedError({ code: 'DENIED', message: 'Denied' })
      },
    })
    const server = fixture.server
    const errors = vi.fn()
    const starts = vi.fn()
    server.events.on('handlerError', errors)
    server.events.on('handlerStart', starts)
    server.handle(fixture.transports.server)
    try {
      const message = await fixture.caller.signToken({
        payload: {
          typ: type,
          prc:
            type === 'request'
              ? 'ping'
              : type === 'stream'
                ? 'watch'
                : type === 'channel'
                  ? 'chat'
                  : 'notify',
          ...(type === 'event' ? { data: {} } : { prm: null }),
          ...(type === 'event' ? {} : { rid: 'blocked' }),
        },
      })
      await fixture.transports.client.write(
        message as unknown as AnyClientMessageOf<typeof protocol>,
      )
      await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(1))
      expect(contexts[0]?.type).toBe(type)
      expect(contexts[0]?.rid).toBe(type === 'event' ? undefined : 'blocked')
      expect(starts).not.toHaveBeenCalled()
      if (type !== 'event') {
        expect((await fixture.transports.client.read()).value?.payload).toMatchObject({
          typ: 'error',
          code: 'DENIED',
        })
      }
    } finally {
      await server.dispose()
      await fixture.transports.dispose()
    }
  },
)

test('access and replay failures do not call the hook', async () => {
  const hook = vi.fn()
  const fixture = setup({ onInvocation: hook })
  fixture.server.handle(fixture.transports.server)
  try {
    await fixture.call({ aud: randomIdentity().id })
    expect(hook).not.toHaveBeenCalled()
    const { message } = await fixture.call()
    expect(hook).toHaveBeenCalledTimes(1)
    await fixture.transports.client.write(message)
    expect((await fixture.transports.client.read()).value?.payload).toMatchObject({ code: 'EK09' })
    expect(hook).toHaveBeenCalledTimes(1)
  } finally {
    await fixture.server.dispose()
    await fixture.transports.dispose()
  }
})

test.each([false, true])(
  'send and abort wait for the invocation hook without calling it (auth=%s)',
  async (auth) => {
    const gate = defer<void>()
    const hook = vi.fn(async () => {
      await gate.promise
    })
    const received: Array<string | undefined> = []
    const fixture = setup({
      auth,
      onInvocation: hook,
      accessRules: { '*': { allow: true } },
      handlers: {
        chat: async ({ readable, signal }) => {
          const reader = readable.getReader()
          received.push((await reader.read()).value)
          if (!signal.aborted) {
            await new Promise<void>((resolve) => {
              signal.addEventListener('abort', () => resolve(), { once: true })
            })
          }
          return 'done'
        },
      },
    })
    const server = fixture.server
    const aborts = vi.fn()
    server.events.on('handlerAbort', aborts)
    server.handle(fixture.transports.server)
    async function send(payload: Record<string, unknown>) {
      const message = await fixture.caller.signToken({
        payload: {
          ...payload,
          rid: 'ordered',
          ...(payload.typ === 'abort' ? {} : { prc: 'chat' }),
          aud: fixture.identity.id,
          iat: Math.floor(Date.now() / 1000),
        },
      })
      await fixture.transports.client.write(
        message as unknown as AnyClientMessageOf<typeof protocol>,
      )
    }
    try {
      await send({ typ: 'channel', prm: null })
      await vi.waitFor(() => expect(hook).toHaveBeenCalledTimes(1))
      await send({ typ: 'send', val: 'hello' })
      await send({ typ: 'abort', rsn: 'finished' })
      gate.resolve()
      await vi.waitFor(() => expect(aborts).toHaveBeenCalledTimes(1))
      expect(received).toEqual(['hello'])
      expect(hook).toHaveBeenCalledTimes(1)
    } finally {
      gate.resolve()
      await server.dispose()
      await fixture.transports.dispose()
    }
  },
)

test('server-subject access proof is reused by the invocation hook', async () => {
  const results: Array<boolean> = []
  const fixture = setup({
    onInvocation: async (ctx) => {
      results.push(...(await Promise.all([ctx.verifyDelegation(), ctx.verifyDelegation()])))
    },
  })
  const verifyToken = vi.fn()
  fixture.server.handle(fixture.transports.server, { verifyToken })
  const capability = await createCapability({
    signer: fixture.identity,
    payload: {
      aud: fixture.caller.id,
      sub: fixture.identity.id,
      act: 'ping',
      res: fixture.identity.id,
    },
  })
  try {
    expect(
      (await fixture.call({ sub: fixture.identity.id, cap: stringifyToken(capability) })).response,
    ).toMatchObject({ typ: 'result' })
    expect(results).toEqual([true, true])
    expect(verifyToken).toHaveBeenCalledTimes(1)
  } finally {
    await fixture.server.dispose()
    await fixture.transports.dispose()
  }
})

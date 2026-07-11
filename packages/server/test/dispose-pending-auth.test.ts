import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import { defer } from '@sozai/async'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('dispose with an in-flight auth check', () => {
  test('an auth-mode handler is not left running un-aborted after dispose() resolves', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    let handlerStarted = false
    let handlerSignal: AbortSignal | undefined
    const handler = vi.fn((ctx: { signal: AbortSignal }) => {
      handlerStarted = true
      handlerSignal = ctx.signal
      return new Promise((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve('aborted'), { once: true })
      })
    })
    const handlers = { 'test/request': handler } as unknown as ProcedureHandlers<Protocol>

    // Blocks the request's access check, so `process()` is still in flight — no
    // controller registered yet — when dispose() runs.
    const gate = defer<void>()
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: {
        '*': {
          allow: async () => {
            await gate.promise
            return true
          },
        },
      },
      transport: transports.server,
    })

    const requestMsg = await clientSigner.signToken({
      typ: 'request',
      prc: 'test/request',
      rid: 'r1',
      aud: serverSigner.id,
    } as const)
    await transports.client.write(requestMsg as unknown as AnyClientMessageOf<Protocol>)

    // The access check is blocked at the gate.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handlerStarted).toBe(false)

    const disposed = server.dispose()
    // Let the disposer reach its awaits, then let the access check through.
    await new Promise((resolve) => setTimeout(resolve, 10))
    gate.resolve()
    await disposed

    // Give anything the disposer failed to wait for a chance to surface.
    await new Promise((resolve) => setTimeout(resolve, 50))

    // The handler must not be running with a never-aborted signal now that
    // dispose() has returned: either it never started, or it was aborted.
    expect({ started: handlerStarted, aborted: handlerSignal?.aborted ?? false }).toEqual({
      started: true,
      aborted: true,
    })

    await transports.dispose()
  })
})

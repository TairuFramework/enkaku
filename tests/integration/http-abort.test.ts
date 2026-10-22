import { Client } from '@enkaku/client'
import { ClientTransport, type ClientTransportParams } from '@enkaku/http-fetch'
import { ServerTransport } from '@enkaku/http-serve'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, serve } from '@enkaku/server'
import { serve as serveHTTP } from '@hono/node-server'
import getPort from 'get-port'
import { describe, expect, test } from 'vitest'

async function createContext<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  transportParams: Omit<ClientTransportParams, 'url'>,
) {
  const port = await getPort()
  const serverTransport = new ServerTransport<Protocol>()
  serve<Protocol>({ handlers, requireAuth: false, transport: serverTransport })
  const httpServer = serveHTTP({ fetch: serverTransport.fetch, port })
  const clientTransport = new ClientTransport<Protocol>({
    ...transportParams,
    url: `http://localhost:${port}`,
  })
  const client = new Client<Protocol>({ transport: clientTransport })

  return {
    client,
    dispose: async () => {
      httpServer.close()
      await Promise.all([clientTransport.dispose(), serverTransport.dispose()])
    },
  }
}

const protocol = {
  withheld: {
    type: 'request',
    param: { type: 'number' },
    result: { type: 'string' },
  },
  responding: {
    type: 'request',
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition

describe('HTTP request cancellation', () => {
  test.each(['abort()', 'config.signal', 'timeout: 50'] as const)(
    'four withheld requests aborted, fifth succeeds with %s',
    async (cancellation) => {
      const started = Array.from({ length: 4 }, () => Promise.withResolvers<void>())
      const aborted = Array.from({ length: 4 }, () => Promise.withResolvers<void>())
      const handlerSignals: Array<AbortSignal> = []
      const { client, dispose } = await createContext<typeof protocol>(
        {
          withheld: ({ param, signal }) => {
            const index = param - 1
            handlerSignals[index] = signal
            return new Promise<string>((resolve) => {
              signal.addEventListener(
                'abort',
                () => {
                  aborted[index].resolve()
                  resolve('ABORTED')
                },
                { once: true },
              )
              started[index].resolve()
            })
          },
          responding: () => 'OK',
        },
        { cancelOnAbort: true },
      )

      try {
        const controllers = Array.from({ length: 4 }, () => new AbortController())
        const reason = new Error('cancel withheld request')
        const calls = controllers.map((controller, param) => {
          return client.request('withheld', {
            param: param + 1,
            ...(cancellation === 'config.signal' ? { signal: controller.signal } : {}),
            ...(cancellation === 'timeout: 50' ? { timeout: 50 } : {}),
          })
        })
        // Observe rejections before the timeout can fire during handler startup.
        const rejected = calls.map((call) => {
          return cancellation === 'timeout: 50'
            ? expect(call).rejects.toMatchObject({
                name: 'RequestTimeoutError',
                code: 'RequestTimeout',
                data: { procedure: 'withheld', timeoutMs: 50 },
              })
            : expect(call).rejects.toBe(reason)
        })

        await Promise.all(started.map(({ promise }) => promise))
        if (cancellation === 'abort()') {
          for (const call of calls) {
            call.abort(reason)
          }
        } else if (cancellation === 'config.signal') {
          for (const controller of controllers) {
            controller.abort(reason)
          }
        }

        await Promise.all(rejected)
        await Promise.all(aborted.map(({ promise }) => promise))
        expect(handlerSignals).toHaveLength(4)
        expect(handlerSignals.every((signal) => signal.aborted)).toBe(true)
        await expect(client.request('responding')).resolves.toBe('OK')
      } finally {
        await dispose()
      }
    },
  )
})

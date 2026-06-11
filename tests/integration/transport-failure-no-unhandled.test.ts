import { createServer, type Server as NetServer, type Socket as NetSocket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, serve } from '@enkaku/server'
import { connectSocket, SocketTransport } from '@enkaku/socket-transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const protocol = {
  wait: {
    type: 'request',
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('transport failure mid-call produces no unhandled errors', () => {
  const rejections: Array<unknown> = []
  const uncaught: Array<unknown> = []
  const onRejection = (reason: unknown) => {
    rejections.push(reason)
  }
  const onUncaught = (error: unknown) => {
    uncaught.push(error)
  }

  beforeEach(() => {
    rejections.length = 0
    uncaught.length = 0
    process.on('unhandledRejection', onRejection)
    process.on('uncaughtException', onUncaught)
  })

  afterEach(() => {
    process.off('unhandledRejection', onRejection)
    process.off('uncaughtException', onUncaught)
  })

  test('socket destroyed with error while a request is in flight', async () => {
    const socketPath = join(
      tmpdir(),
      `enkaku-it-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const netServer = await new Promise<NetServer>((resolve) => {
      const srv = createServer()
      srv.listen(socketPath, () => resolve(srv))
    })
    const serverSocketPromise = new Promise<NetSocket>((resolve) => {
      netServer.once('connection', resolve)
    })

    const handlers = {
      wait: async (ctx: { signal: AbortSignal }) => {
        await new Promise<void>((resolve) => {
          ctx.signal.addEventListener('abort', () => resolve(), { once: true })
        })
        return null
      },
    } as unknown as ProcedureHandlers<Protocol>

    const clientSocket = await connectSocket(socketPath)
    const clientTransport = new SocketTransport<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >({ socket: clientSocket })
    const client = new Client<Protocol>({ transport: clientTransport })

    const serverSocket = await serverSocketPromise
    const serverTransport = new SocketTransport<
      AnyClientMessageOf<Protocol>,
      AnyServerMessageOf<Protocol>
    >({ socket: serverSocket })
    const server = serve<Protocol>({ handlers, protocol, transport: serverTransport })

    const request = client.request('wait')
    // Let the request reach the server handler
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Hard failure on both ends mid-call
    clientSocket.destroy(new Error('connection reset'))
    serverSocket.destroy(new Error('connection reset'))

    // The in-flight call must reject instead of hanging
    await expect(request).rejects.toBeInstanceOf(Error)

    // Both sides must dispose cleanly (server read loop settled via Task 4)
    await client.dispose()
    await server.dispose()
    netServer.close()

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(
      uncaught,
      `unexpected uncaught exceptions: ${uncaught.map(String).join(', ')}`,
    ).toHaveLength(0)
    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
  })
})

import { createServer, type Socket as NetSocket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'

import { connectSocket, SocketTransport } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-signal-dispose-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const server = createServer()
    server.listen(socketPath, () => {
      resolve({ server, socketPath })
    })
  })
}

function waitForConnection(server: Server): Promise<NetSocket> {
  return new Promise((resolve) => {
    server.once('connection', resolve)
  })
}

describe('SocketTransport external signal', () => {
  test('aborting the signal disposes the transport and destroys the socket', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const controller = new AbortController()
    let clientSocket: NetSocket | undefined
    const transport = new SocketTransport<unknown, { ping: boolean }>({
      socket: async () => {
        clientSocket = await connectSocket(socketPath)
        return clientSocket
      },
      signal: controller.signal,
    })

    const disposed = vi.fn()
    transport.events.on('disposed', disposed)

    // Force the lazy connect so there is a real socket to release.
    await transport.write({ ping: true })
    const serverSocket = await connectionPromise
    serverSocket.resume()
    expect(clientSocket?.destroyed).toBe(false)

    controller.abort()
    await transport.disposed

    // The whole chain: signal -> dispose() -> 'disposed' -> socket released.
    // Before this branch the abort did nothing at all: no dispose, no destroy.
    expect(disposed).toHaveBeenCalledTimes(1)
    expect(clientSocket?.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 10_000)

  test('aborting during a pending connect rejects the connect and still disposes cleanly', async () => {
    // A path that never resolves a socket: nothing is listening, and the connect
    // is abandoned mid-flight. The transport must still dispose -- the 'disposed'
    // hook awaits the socket promise, which rejects, and must swallow it.
    const socketPath = join(
      tmpdir(),
      `enkaku-nothing-listening-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const controller = new AbortController()
    const transport = new SocketTransport<unknown, { ping: boolean }>({
      socket: socketPath,
      signal: controller.signal,
      connectTimeoutMs: 0,
    })

    const disposed = vi.fn()
    transport.events.on('disposed', disposed)

    // Kick off the lazy connect, then abort it before it can settle.
    const write = transport.write({ ping: true })
    write.catch(() => {})
    controller.abort()

    await expect(write).rejects.toThrow()
    await expect(transport.disposed).resolves.toBeUndefined()
    expect(disposed).toHaveBeenCalledTimes(1)
  }, 10_000)
})

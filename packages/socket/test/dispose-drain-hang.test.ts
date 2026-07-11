import { createServer, type Socket as NetSocket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { connectSocket, SocketTransport } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-dispose-drain-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
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

describe('SocketTransport dispose() vs a peer that never reads', () => {
  test('dispose() resolves and destroys the socket while a write is stuck mid-drain', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    // Captured via a function source, the same shape a reconnecting client
    // uses -- the test needs a handle on the raw Socket to assert destroyed.
    let clientSocket: NetSocket | undefined
    const transport = new SocketTransport<unknown, { n: number; payload?: string }>({
      socket: async () => {
        clientSocket = await connectSocket(socketPath)
        return clientSocket
      },
    })

    // A small write establishes the connection and proves the round-trip
    // works before the peer goes silent.
    const firstWrite = transport.write({ n: 1 })
    const serverSocket = await connectionPromise
    await firstWrite
    // The server accepts the connection and never calls resume() or attaches
    // a 'data' listener -- it never reads. There is therefore no 'drain'
    // coming once the client's own send buffer fills.

    const bigPayload = 'x'.repeat(8 * 1_048_576)
    // Deliberately unawaited: this write is the one that gets stuck awaiting
    // 'drain' forever. That is this bug's signature -- not a rejection, a
    // write that never settles.
    void transport.write({ n: 2, payload: bigPayload }).catch(() => {})

    // Give the big write a moment to actually hit backpressure before
    // disposing, so the race below genuinely exercises the stuck-drain path.
    await new Promise((resolve) => setTimeout(resolve, 50))

    await expect(
      Promise.race([
        transport.dispose(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('dispose() did not settle')), 3_000),
        ),
      ]),
    ).resolves.toBeUndefined()

    // The peer never observes a FIN it never reads -- that part is
    // unwinnable from the client. But the client's own socket must be gone.
    expect(clientSocket?.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 6_000)
})

import { createServer, type Server, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SocketTransport } from '@enkaku/socket'
import { describe, expect, test } from 'vitest'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-dispose-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const server = createServer()
    server.listen(socketPath, () => {
      resolve({ server, socketPath })
    })
  })
}

/** Resolves once the server has closed -- which only happens after every connection is gone. */
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      error ? reject(error) : resolve()
    })
  })
}

describe('SocketTransport dispose releases the peer server', () => {
  test('a draining server closes once the client transport disposes', async () => {
    const { server, socketPath } = await createTestServer()
    const connections: Array<Socket> = []
    server.on('connection', (socket) => {
      connections.push(socket)
      // Expected once the client is destroyed out from under the pending
      // write below -- a real server would have its own permanent listener.
      socket.on('error', () => {})
      // Drain the client's outgoing messages, like a real peer would.
      socket.resume()
      // Also push back more than the client will ever read. A graceful FIN
      // from the client -- which the pre-fix `unref()`-only dispose still
      // sends, via the writable close callback's `socket.end()` -- is not
      // enough on its own to unblock this server: with data still queued for
      // a client that never reads it, the server's own outgoing write stays
      // backpressured forever, so its side of the duplex never finishes and
      // `server.close()` hangs regardless of the client's FIN. Only an actual
      // close of the client socket -- `destroy()`, not `unref()` -- fails this
      // pending write with EPIPE, letting the server's connection, and
      // `server.close()`, finish. This is what actually distinguishes the fix
      // from the bug: without it, a real draining peer (like the tejika
      // daemon, which both reads and writes to its clients) hangs exactly
      // like this.
      socket.write(Buffer.alloc(5 * 1_048_576, 'x'))
    })

    // The reconnecting-client shape: a bare socket path, used without a Client
    const transport = new SocketTransport<{ n: number }, { n: number }>({
      socket: socketPath,
    })
    await transport.write({ n: 1 })
    expect(connections).toHaveLength(1)
    // Let the server's write land before disposing, so the client's socket
    // genuinely has unread data queued when it is released.
    await new Promise((resolve) => setTimeout(resolve, 50))

    await transport.dispose()

    // server.close() waits for its open connections. If dispose only unref()d the
    // socket, the connection stays live and this never resolves.
    await expect(
      Promise.race([
        closeServer(server),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('server did not close: connection still open')), 2000),
        ),
      ]),
    ).resolves.toBeUndefined()
  })
})

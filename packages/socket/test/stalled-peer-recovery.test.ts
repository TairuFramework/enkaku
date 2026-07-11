import { createServer, type Socket as NetSocket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { connectSocket, SocketTransport } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-stalled-peer-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
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

describe('SocketTransport dispose() vs a peer that stalls then recovers', () => {
  // This is the scenario `dispose-drain-hang.test.ts` cannot catch: that test's
  // peer never reads at all, so it only proves dispose() is *bounded*. This one
  // proves dispose() does not *truncate* -- a peer that resumes reading within
  // the grace window must still receive every byte that was in flight when
  // dispose() was called.
  //
  // Against an instant-reject `waitForDrain` (the regression this guards),
  // this fails on a concrete truncated byte count, not a timeout: the abort
  // rejects the in-flight write immediately, which errors the WritableStream,
  // which makes `writer.close()` reject *without ever invoking its close
  // callback* -- so the flush-on-close grace never runs and `dispose()`
  // destroys the socket with most of the payload still queued.
  test('flushes the full payload once a stalled peer resumes reading', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    let clientSocket: NetSocket | undefined
    const transport = new SocketTransport<unknown, { payload: string }>({
      socket: async () => {
        clientSocket = await connectSocket(socketPath)
        return clientSocket
      },
    })

    // Several MiB -- big enough that socket.write() returns false and the
    // write genuinely hits backpressure (a small payload never enters
    // waitForDrain at all, and would not exercise this bug).
    const payload = 'x'.repeat(8 * 1_048_576)
    const encoded = `${JSON.stringify({ payload })}\n`

    // Deliberately unawaited: this is the write that gets stuck awaiting
    // 'drain'. A dead-peer abort can legitimately reject it (see the
    // changeset); attach a no-op catch immediately so that legitimate
    // rejection never surfaces as an unhandled rejection before the real
    // assertion below gets a chance to inspect it.
    const bigWrite = transport.write({ payload })
    bigWrite.catch(() => {})
    const serverSocket = await connectionPromise
    // The server accepts the connection but never reads: no 'data' listener
    // and no resume() -- bytes pile up in the kernel and Node's own write
    // buffer with nowhere to go, exactly like a stalled (not yet dead) peer.

    // Give the write a moment to actually hit backpressure before disposing.
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Dispose WITHOUT awaiting -- it must not truncate the in-flight write.
    const disposePromise = transport.dispose()

    let receivedBytes = 0
    const serverDone = new Promise<void>((resolve) => {
      serverSocket.on('end', resolve)
      serverSocket.on('close', resolve)
    })

    // ~400ms later, the peer recovers and starts reading again.
    await new Promise((resolve) => setTimeout(resolve, 400))
    serverSocket.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length
    })
    serverSocket.resume()

    // dispose() must still settle -- recovering must not turn the bound into
    // an unbounded wait either.
    await expect(
      Promise.race([
        disposePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('dispose() did not settle')), 5_000),
        ),
      ]),
    ).resolves.toBeUndefined()

    await bigWrite.catch(() => {})
    await serverDone

    // The full JSON line, not a truncated prefix.
    expect(receivedBytes).toBe(encoded.length)

    serverSocket.destroy()
    server.close()
  }, 8_000)
})

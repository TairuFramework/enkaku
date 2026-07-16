import { createServer, type Socket as NetSocket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { connectSocket, createTransportStream } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-socket-release-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
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

// A bare consumer -- createTransportStream with no Transport on top, and so no
// 'disposed' hook to destroy the socket for it. mokei's host-monitor is one.
// end() + unref() leaves the socket open: unref() only stops it holding the
// event loop, and the peer keeps seeing a live connection.
describe('bare createTransportStream socket release', () => {
  test('destroys the socket after a clean close against a healthy peer', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const { writable } = await createTransportStream<unknown, { payload: string }>(socket)

    const serverSocket = await connectionPromise
    let receivedBytes = 0
    serverSocket.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length
    })
    const serverDone = new Promise<void>((resolve) => {
      serverSocket.on('end', resolve)
      serverSocket.on('close', resolve)
    })

    const payload = 'x'.repeat(1024)
    const encoded = `${JSON.stringify({ payload })}\n`

    const writer = writable.getWriter()
    await writer.write({ payload })
    await writer.close()
    await serverDone

    // Releasing must not truncate: the flush still runs before the destroy.
    expect(receivedBytes).toBe(encoded.length)
    // The peer read everything, so the end() grace never expired -- and this is
    // exactly the case a "destroy only when the grace expires" fix would miss.
    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 10_000)

  test('destroys the socket when the sink write rejects against a stalled peer', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const controller = new AbortController()
    const { writable } = await createTransportStream<unknown, { payload: string }>(socket, {
      signal: controller.signal,
    })

    const serverSocket = await connectionPromise
    // Never reads: no 'data' listener, no resume(). Bytes pile up with nowhere
    // to go, so socket.write() returns false and the write parks in waitForDrain.

    const writer = writable.getWriter()
    // Several MiB, so the write genuinely hits backpressure. A small payload
    // never enters waitForDrain at all and would not exercise this path.
    const bigWrite = writer.write({ payload: 'x'.repeat(8 * 1_048_576) })
    // The abort below legitimately rejects this write; catch immediately so it
    // never surfaces as an unhandled rejection.
    bigWrite.catch(() => {})

    await new Promise((resolve) => setTimeout(resolve, 50))

    // waitForDrain gives the peer END_GRACE_MS (2s) to recover, then rejects.
    controller.abort()
    await bigWrite.catch(() => {})

    // The rejected write errors the WritableStream, which runs NEITHER the
    // `close` nor the `abort` sink callback -- so this is the exit that a
    // release living only in the close callback misses entirely.
    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 15_000)

  test('destroys the socket when the writer is explicitly aborted', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const { writable } = await createTransportStream<unknown, { payload: string }>(socket)

    const serverSocket = await connectionPromise

    const writer = writable.getWriter()
    await writer.abort(new Error('caller gave up'))

    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 10_000)
})

import { createServer, type Socket as NetSocket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'

import { connectSocket, createTransportStream, SocketTransport } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
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

describe('connectSocket()', () => {
  test('connects to a Unix socket', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise

    expect(socket).toBeDefined()
    expect(socket.connecting).toBe(false)

    socket.destroy()
    serverSocket.destroy()
    server.close()
  })

  test('rejects when socket path does not exist', async () => {
    await expect(connectSocket('/nonexistent/path.sock')).rejects.toThrow()
  })
})

describe('createTransportStream()', () => {
  test('sends and receives JSON-lines messages', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<{ value: string }, { value: string }>(socket)

    // Send message from server to client through the socket
    serverSocket.write(`${JSON.stringify({ value: 'from-server' })}\n`)

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual({ value: 'from-server' })

    // Send message from client to server through the stream
    const serverReceived = new Promise<string>((resolve) => {
      let data = ''
      serverSocket.on('data', (chunk) => {
        data += chunk.toString()
        if (data.includes('\n')) {
          resolve(data.trim())
        }
      })
    })

    const writer = stream.writable.getWriter()
    await writer.write({ value: 'from-client' })

    const received = await serverReceived
    expect(JSON.parse(received)).toEqual({ value: 'from-client' })

    await writer.close()
    reader.releaseLock()
    serverSocket.destroy()
    server.close()
  })

  test('handles multiple messages', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<{ n: number }, unknown>(socket)

    // Send multiple messages separated by newlines
    serverSocket.write('{"n":1}\n{"n":2}\n{"n":3}\n')

    const reader = stream.readable.getReader()
    const first = await reader.read()
    const second = await reader.read()
    const third = await reader.read()
    expect(first.value).toEqual({ n: 1 })
    expect(second.value).toEqual({ n: 2 })
    expect(third.value).toEqual({ n: 3 })

    reader.releaseLock()
    socket.destroy()
    serverSocket.destroy()
    server.close()
  })

  test('accepts a factory function as source', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const stream = await createTransportStream<{ ok: boolean }, unknown>(() =>
      connectSocket(socketPath),
    )
    const serverSocket = await connectionPromise

    serverSocket.write('{"ok":true}\n')

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual({ ok: true })

    reader.releaseLock()
    serverSocket.destroy()
    server.close()
  })

  test('decodes multi-byte UTF-8 characters split across socket chunks', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<{ text: string }, unknown>(socket)

    const bytes = Buffer.from('{"text":"héllo 🌍"}\n', 'utf8')
    // Write byte-by-byte with a small delay so multi-byte sequences are
    // guaranteed to arrive in separate 'data' events
    for (let i = 0; i < bytes.length; i++) {
      serverSocket.write(bytes.subarray(i, i + 1))
      await new Promise((resolve) => setTimeout(resolve, 1))
    }

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual({ text: 'héllo 🌍' })

    reader.releaseLock()
    socket.destroy()
    serverSocket.destroy()
    server.close()
  })

  test('flushes buffered writes before the writer close resolves', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<unknown, { payload: string }>(socket)

    // Small enough that socket.write() returns `true` (no backpressure), so
    // the write callback never awaits 'drain'. That is exactly the case that
    // exposes the bug: a payload big enough to force a 'drain' wait would
    // already be fully handed to the kernel by the time the write's promise
    // resolves, masking the race regardless of the fix. A message under the
    // socket's ~16 KiB write high-water mark is what genuinely races.
    const payload = 'x'.repeat(10_000)
    let receivedBytes = 0
    const serverDone = new Promise<void>((resolve) => {
      serverSocket.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length
      })
      serverSocket.on('end', () => resolve())
      // Mirrors Task 3's dispose hook, which destroy()s the socket right
      // after the writer closes -- so the peer only ever sees a 'close',
      // not a graceful 'end', when the bytes get cut off.
      serverSocket.on('close', () => resolve())
    })

    const writer = stream.writable.getWriter()
    // Deliberately not awaited: the close below must flush whatever is queued.
    void writer.write({ payload })
    await writer.close()
    // Simulates Task 3's post-close destroy(). Without the fix, this lands
    // while bytes are still queued in the socket's internal buffer.
    socket.destroy()

    await serverDone
    // The full JSON line, not a truncated prefix
    expect(receivedBytes).toBe(JSON.stringify({ payload }).length + 1)

    serverSocket.destroy()
    server.close()
  })
})

describe('createTransportStream() error handling', () => {
  test('propagates socket close to readable stream', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<unknown, unknown>(socket)

    const reader = stream.readable.getReader()

    // Force-destroy the server side to cause close on client side
    serverSocket.destroy()

    // The stream should close when the socket closes
    const result = await reader.read()
    expect(result.done).toBe(true)

    server.close()
  })

  test('socket error followed by close does not throw an uncaught exception', async () => {
    const uncaught: Array<unknown> = []
    const onUncaught = (error: unknown) => {
      uncaught.push(error)
    }
    process.on('uncaughtException', onUncaught)
    try {
      const { server, socketPath } = await createTestServer()
      const connectionPromise = waitForConnection(server)

      const socket = await connectSocket(socketPath)
      const serverSocket = await connectionPromise
      const stream = await createTransportStream<unknown, unknown>(socket)
      const reader = stream.readable.getReader()

      // destroy(error) emits 'error' then 'close' on the socket
      socket.destroy(new Error('boom'))
      await expect(reader.read()).rejects.toThrow('boom')

      // Let the trailing 'close' event fire — pre-fix this calls
      // controller.close() on an errored controller → uncaughtException
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(uncaught, `uncaught exceptions: ${uncaught.map(String).join(', ')}`).toHaveLength(0)

      serverSocket.destroy()
      server.close()
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })
})

describe('SocketTransport', () => {
  test('reads and writes via Transport interface with socket path string', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const transport = new SocketTransport<{ msg: string }, { msg: string }>({
      socket: socketPath,
    })
    // The socket path now connects lazily on first read/write, so kick off the
    // read before awaiting the server-side connection it triggers.
    const readPromise = transport.read()
    const serverSocket = await connectionPromise

    // Server sends to client
    serverSocket.write('{"msg":"hello"}\n')
    const result = await readPromise
    expect(result.value).toEqual({ msg: 'hello' })

    // Client sends to server
    const serverReceived = new Promise<string>((resolve) => {
      let data = ''
      serverSocket.on('data', (chunk) => {
        data += chunk.toString()
        if (data.includes('\n')) {
          resolve(data.trim())
        }
      })
    })
    await transport.write({ msg: 'world' })
    const received = await serverReceived
    expect(JSON.parse(received)).toEqual({ msg: 'world' })

    await transport.dispose()
    serverSocket.destroy()
    server.close()
  })

  test('accepts a Socket instance directly', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise

    const transport = new SocketTransport<{ n: number }, unknown>({ socket })

    serverSocket.write('{"n":42}\n')
    const result = await transport.read()
    expect(result.value).toEqual({ n: 42 })

    await transport.dispose()
    serverSocket.destroy()
    server.close()
  })

  test('accepts a Promise<Socket> and destroys it on dispose', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    let opened: NetSocket | undefined
    const socketPromise = connectSocket(socketPath).then((sock) => {
      opened = sock
      return sock
    })
    const transport = new SocketTransport<{ n: number }, unknown>({ socket: socketPromise })
    const serverSocket = await connectionPromise

    serverSocket.write('{"n":7}\n')
    const result = await transport.read()
    expect(result.value).toEqual({ n: 7 })

    await transport.dispose()

    expect(opened?.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })

  test('destroys the socket on dispose', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const unrefSpy = vi.spyOn(socket, 'unref')

    const transport = new SocketTransport<{ n: number }, unknown>({ socket })

    // Drive a round-trip so the stream is established
    serverSocket.write('{"n":1}\n')
    const result = await transport.read()
    expect(result.value).toEqual({ n: 1 })

    await transport.dispose()

    // The writer close flushed and half-closed it, then the disposed hook
    // destroyed it -- unref() alone left the peer seeing a live connection.
    expect(unrefSpy).toHaveBeenCalled()
    expect(socket.writableEnded).toBe(true)
    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })

  test('destroys the socket on dispose when the stream was never used', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise

    // Construct the transport but never read/write: the lazily-created transport
    // stream is never materialized, so the writable-close cleanup never runs and
    // the disposed hook is the only path that can release the socket.
    const transport = new SocketTransport<{ n: number }, unknown>({ socket })

    await transport.dispose()

    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })

  test('destroys the socket opened by a function source on dispose', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    // The reconnecting-client shape: the socket is created by the source, so
    // the caller has no handle on it and cannot release it itself.
    let opened: NetSocket | undefined
    const transport = new SocketTransport<{ n: number }, unknown>({
      socket: async () => {
        opened = await connectSocket(socketPath)
        return opened
      },
    })
    // The function source connects lazily on first read/write, so kick off the
    // read before awaiting the server-side connection it triggers.
    const readPromise = transport.read()
    const serverSocket = await connectionPromise

    serverSocket.write('{"n":3}\n')
    const result = await readPromise
    expect(result.value).toEqual({ n: 3 })

    await transport.dispose()

    expect(opened?.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })

  test('opens no socket when a function source transport is disposed unused', async () => {
    const { server, socketPath } = await createTestServer()

    let calls = 0
    const transport = new SocketTransport<{ n: number }, unknown>({
      socket: () => {
        calls++
        return connectSocket(socketPath)
      },
    })

    await transport.dispose()

    // Nothing was ever connected, so there is nothing to release -- and dispose
    // must not connect one just to destroy it.
    expect(calls).toBe(0)

    server.close()
  })

  // A short, explicit timeout: without the dispose guard, read() opens a
  // fresh connection and then hangs waiting for data that never arrives, so
  // it never rejects at all. Racing it against a short delay -- rather than
  // just awaiting it -- lets the test reach the concrete connection-count
  // assertion below instead of failing only on the harness's default 5000ms
  // timeout, which would mask that assertion entirely.
  test('a read() after dispose rejects and opens no orphan socket', async () => {
    const { server, socketPath } = await createTestServer()
    let connections = 0
    server.on('connection', () => {
      connections++
    })

    const transport = new SocketTransport<{ n: number }, unknown>({ socket: socketPath })
    // Never read/write before disposing -- the lazy connect never fires.
    await transport.dispose()

    await expect(
      Promise.race([
        transport.read(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('read() did not settle')), 200),
        ),
      ]),
    ).rejects.toThrow()
    // Give a would-be connection a chance to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(connections).toBe(0)

    server.close()
  }, 1000)
})

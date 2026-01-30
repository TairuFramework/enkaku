import { createServer, type Server, type Socket as NetSocket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { connectSocket, createTransportStream, SocketTransport } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(tmpdir(), `enkaku-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`)
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
    serverSocket.write(JSON.stringify({ value: 'from-server' }) + '\n')

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

    const stream = await createTransportStream<{ ok: boolean }, unknown>(
      () => connectSocket(socketPath),
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
})

describe('SocketTransport', () => {
  test('reads and writes via Transport interface with socket path string', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const transport = new SocketTransport<{ msg: string }, { msg: string }>({
      socket: socketPath,
    })
    const serverSocket = await connectionPromise

    // Server sends to client
    serverSocket.write('{"msg":"hello"}\n')
    const result = await transport.read()
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

  test('accepts a Promise<Socket>', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const transport = new SocketTransport<{ n: number }, unknown>({
      socket: connectSocket(socketPath),
    })
    const serverSocket = await connectionPromise

    serverSocket.write('{"n":7}\n')
    const result = await transport.read()
    expect(result.value).toEqual({ n: 7 })

    await transport.dispose()
    serverSocket.destroy()
    server.close()
  })
})

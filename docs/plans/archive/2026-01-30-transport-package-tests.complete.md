# Transport Package Test Suites (T-04) Implementation Plan

**Status:** complete

| Package | Tests | Commits |
|---------|-------|---------|
| `@enkaku/message-transport` | 8 (stream creation, source resolution, Transport class) | `7b18f06`, `db40aad` |
| `@enkaku/socket-transport` | 9 (connection, JSON-lines, Transport class, error handling) | `f80e482`, `bf1fc3a` |
| `@enkaku/http-client-transport` | 11 (ResponseError, message routing, SSE session, SSE reception, ClientTransport) | `8785326`, `379584d`, `ebc1ab7`, `2c771c2` |

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add comprehensive test suites to the three transport packages with zero test coverage: `@enkaku/message-transport`, `@enkaku/socket-transport`, and `@enkaku/http-client-transport`.

**Architecture:** Each package gets a `test/lib.test.ts` file with unit tests covering stream creation, message flow, error handling, disposal, and source resolution. Tests mock external dependencies (MessagePort, Node sockets, fetch/EventSource) to test transport logic in isolation. Package.json files are updated to include `test:unit` scripts.

**Tech Stack:** Vitest (test runner), `vi.fn()` / `vi.mock()` (mocking), Node.js `MessageChannel` (for MessagePort tests), Node.js `net.createServer` (for socket tests)

**Security audit reference:** `docs/plans/2026-01-28-security-audit.md` — T-04: Transport Packages - Zero Coverage (CRITICAL priority)

---

## Task 1: message-transport — Package Setup and Basic Stream Creation Tests

**Files:**
- Create: `packages/message-transport/test/lib.test.ts`
- Modify: `packages/message-transport/package.json` (add `test:unit` script)

**Step 1: Add test:unit script to package.json**

In `packages/message-transport/package.json`, update the `scripts` section:

```json
{
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build:types:ci": "tsc --emitDeclarationOnly --skipLibCheck --declarationMap false",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  }
}
```

**Step 2: Write initial tests for createTransportStream and message flow**

Create `packages/message-transport/test/lib.test.ts`:

```typescript
import { MessageChannel } from 'node:worker_threads'
import { describe, expect, test } from 'vitest'

import { createTransportStream, MessageTransport } from '../src/index.js'

describe('createTransportStream()', () => {
  test('receives messages from a MessagePort', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ value: string }, unknown>(port1)

    const reader = stream.readable.getReader()
    port2.postMessage({ value: 'hello' })

    const result = await reader.read()
    expect(result.value).toEqual({ value: 'hello' })

    port1.close()
    port2.close()
  })

  test('sends messages through a MessagePort', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<unknown, { value: string }>(port1)

    const received = new Promise<{ value: string }>((resolve) => {
      port2.on('message', resolve)
    })

    const writer = stream.writable.getWriter()
    await writer.write({ value: 'hello' })

    const msg = await received
    expect(msg).toEqual({ value: 'hello' })

    await writer.close()
    port1.close()
    port2.close()
  })

  test('handles multiple messages in sequence', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<number, number>(port1)

    const reader = stream.readable.getReader()

    port2.postMessage(1)
    port2.postMessage(2)
    port2.postMessage(3)

    const first = await reader.read()
    const second = await reader.read()
    const third = await reader.read()
    expect(first.value).toBe(1)
    expect(second.value).toBe(2)
    expect(third.value).toBe(3)

    port1.close()
    port2.close()
  })
})
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/message-transport test:unit`
Expected: 3 tests pass

**Step 4: Commit**

```bash
git add packages/message-transport/test/lib.test.ts packages/message-transport/package.json
git commit -m "test(message-transport): add stream creation and message flow tests (T-04)"
```

---

## Task 2: message-transport — Source Resolution and Transport Class Tests

**Files:**
- Modify: `packages/message-transport/test/lib.test.ts`

**Step 1: Add source resolution and MessageTransport class tests**

Append to `packages/message-transport/test/lib.test.ts`:

```typescript
describe('createTransportStream() source resolution', () => {
  test('accepts a Promise<MessagePort>', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ n: number }, unknown>(Promise.resolve(port1))

    const reader = stream.readable.getReader()
    port2.postMessage({ n: 42 })

    const result = await reader.read()
    expect(result.value).toEqual({ n: 42 })

    port1.close()
    port2.close()
  })

  test('accepts a factory function returning MessagePort', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ n: number }, unknown>(() => port1)

    const reader = stream.readable.getReader()
    port2.postMessage({ n: 99 })

    const result = await reader.read()
    expect(result.value).toEqual({ n: 99 })

    port1.close()
    port2.close()
  })

  test('accepts a factory function returning Promise<MessagePort>', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ n: number }, unknown>(
      () => Promise.resolve(port1),
    )

    const reader = stream.readable.getReader()
    port2.postMessage({ n: 7 })

    const result = await reader.read()
    expect(result.value).toEqual({ n: 7 })

    port1.close()
    port2.close()
  })
})

describe('MessageTransport', () => {
  test('reads and writes messages via Transport interface', async () => {
    const { port1, port2 } = new MessageChannel()
    const transport = new MessageTransport<string, string>({ port: port1 })

    // Write a message via the transport
    const received = new Promise<string>((resolve) => {
      port2.on('message', resolve)
    })
    await transport.write('outgoing')
    expect(await received).toBe('outgoing')

    // Read a message via the transport
    port2.postMessage('incoming')
    const result = await transport.read()
    expect(result.value).toBe('incoming')

    await transport.dispose()
    port1.close()
    port2.close()
  })

  test('supports async iteration', async () => {
    const { port1, port2 } = new MessageChannel()
    const transport = new MessageTransport<number, unknown>({ port: port1 })

    port2.postMessage(10)
    port2.postMessage(20)

    const values: Array<number> = []
    for await (const value of transport) {
      values.push(value)
      if (values.length === 2) {
        await transport.dispose()
      }
    }
    expect(values).toEqual([10, 20])

    port1.close()
    port2.close()
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/message-transport test:unit`
Expected: All tests pass (3 previous + 5 new = 8 total)

**Step 3: Commit**

```bash
git add packages/message-transport/test/lib.test.ts
git commit -m "test(message-transport): add source resolution and Transport class tests (T-04)"
```

---

## Task 3: socket-transport — Package Setup and Socket Connection Tests

**Files:**
- Create: `packages/socket-transport/test/lib.test.ts`
- Modify: `packages/socket-transport/package.json` (add `test:unit` script, add vitest)

**Step 1: Add test:unit script to package.json**

In `packages/socket-transport/package.json`, update the `scripts` section:

```json
{
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build:types:ci": "tsc --emitDeclarationOnly --skipLibCheck --declarationMap false",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  }
}
```

**Step 2: Write socket connection and stream creation tests**

Create `packages/socket-transport/test/lib.test.ts`:

```typescript
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
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/socket-transport test:unit`
Expected: All tests pass (5 total)

**Step 4: Commit**

```bash
git add packages/socket-transport/test/lib.test.ts packages/socket-transport/package.json
git commit -m "test(socket-transport): add connection and stream creation tests (T-04)"
```

---

## Task 4: socket-transport — SocketTransport Class and Error Handling Tests

**Files:**
- Modify: `packages/socket-transport/test/lib.test.ts`

**Step 1: Add SocketTransport class and error propagation tests**

Append to `packages/socket-transport/test/lib.test.ts`:

```typescript
describe('createTransportStream() error handling', () => {
  test('propagates socket errors to readable stream', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<unknown, unknown>(socket)

    const reader = stream.readable.getReader()

    // Force-destroy the server side to cause an error/close on client side
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
```

**Step 2: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/socket-transport test:unit`
Expected: All tests pass (5 previous + 4 new = 9 total)

**Step 3: Commit**

```bash
git add packages/socket-transport/test/lib.test.ts
git commit -m "test(socket-transport): add Transport class and error handling tests (T-04)"
```

---

## Task 5: http-client-transport — Package Setup and ResponseError Tests

**Files:**
- Create: `packages/http-client-transport/test/lib.test.ts`
- Modify: `packages/http-client-transport/package.json` (add `test:unit` script)

**Step 1: Add test:unit script to package.json**

In `packages/http-client-transport/package.json`, update the `scripts` section:

```json
{
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build:types:ci": "tsc --emitDeclarationOnly --skipLibCheck --declarationMap false",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  }
}
```

**Step 2: Write ResponseError and createTransportStream basic tests**

Create `packages/http-client-transport/test/lib.test.ts`.

This package is harder to test because it depends on `fetch()` and `EventSource`, both browser/runtime APIs. We mock these globally.

```typescript
import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

import { ResponseError, createTransportStream } from '../src/index.js'

describe('ResponseError', () => {
  test('stores the response object', () => {
    const response = new Response('Not Found', { status: 404, statusText: 'Not Found' })
    const error = new ResponseError(response)
    expect(error.response).toBe(response)
    expect(error.message).toBe('Transport request failed with status 404 (Not Found)')
  })

  test('is an instance of Error', () => {
    const response = new Response('', { status: 500, statusText: 'Internal Server Error' })
    const error = new ResponseError(response)
    expect(error).toBeInstanceOf(Error)
  })
})
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-client-transport test:unit`
Expected: 2 tests pass

**Step 4: Commit**

```bash
git add packages/http-client-transport/test/lib.test.ts packages/http-client-transport/package.json
git commit -m "test(http-client-transport): add ResponseError tests (T-04)"
```

---

## Task 6: http-client-transport — Transport Stream Message Routing Tests

**Files:**
- Modify: `packages/http-client-transport/test/lib.test.ts`

This is the core test: `createTransportStream()` routes messages via `fetch()` and connects to SSE for channel/stream procedures. We mock `fetch` and `EventSource` globally.

**Step 1: Add fetch-based message flow tests**

Append to `packages/http-client-transport/test/lib.test.ts`:

```typescript
// Minimal protocol for testing
const protocol = {
  'test/event': { type: 'event', data: { type: 'string' } },
  'test/request': { type: 'request', result: { type: 'string' } },
  'test/stream': { type: 'stream', result: { type: 'string' } },
  'test/channel': { type: 'channel', data: { type: 'string' }, result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('createTransportStream()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('sends event messages via POST and handles 204 response', async () => {
    const requests: Array<{ url: string; body: string; headers: Record<string, string> }> = []

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({
        url: req.url,
        body: await req.text(),
        headers: Object.fromEntries(req.headers.entries()),
      })
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const eventMsg = { payload: { typ: 'event', prc: 'test/event', data: 'hello' } } as any
    await writer.write(eventMsg)

    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('http://localhost/rpc')
    expect(JSON.parse(requests[0].body)).toEqual(eventMsg)
    // No enkaku-session-id header for events
    expect(requests[0].headers['enkaku-session-id']).toBeUndefined()

    await writer.close()
  })

  test('sends request messages via POST and enqueues response', async () => {
    const responsePayload = { payload: { typ: 'result', val: 'world' } }

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const requestMsg = { payload: { typ: 'request', prc: 'test/request' } } as any
    await writer.write(requestMsg)

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual(responsePayload)

    await writer.close()
  })

  test('errors the readable stream when POST returns non-ok response', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const requestMsg = { payload: { typ: 'request', prc: 'test/request' } } as any
    await writer.write(requestMsg)

    const reader = stream.readable.getReader()
    await expect(reader.read()).rejects.toThrow('Transport request failed with status 500')
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-client-transport test:unit`
Expected: All tests pass (2 previous + 3 new = 5 total)

**Step 3: Commit**

```bash
git add packages/http-client-transport/test/lib.test.ts
git commit -m "test(http-client-transport): add transport stream message routing tests (T-04)"
```

---

## Task 7: http-client-transport — SSE Session and Channel/Stream Routing Tests

**Files:**
- Modify: `packages/http-client-transport/test/lib.test.ts`

Channel and stream messages trigger lazy SSE connection via `createEventStream()`. We mock both `fetch` (for SSE setup GET + POST) and `EventSource`.

**Step 1: Add SSE session and channel message tests**

Append to `packages/http-client-transport/test/lib.test.ts`:

```typescript
describe('createEventStream()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('throws ResponseError when fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' })
    }) as typeof fetch

    const { createEventStream } = await import('../src/index.js')
    await expect(createEventStream('http://localhost/rpc')).rejects.toThrow(
      'Transport request failed with status 404',
    )
  })
})

describe('createTransportStream() SSE session handling', () => {
  let originalFetch: typeof globalThis.fetch
  let originalEventSource: typeof globalThis.EventSource

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalEventSource = globalThis.EventSource
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.EventSource = originalEventSource
  })

  test('channel messages include enkaku-session-id header', async () => {
    const requests: Array<{ headers: Record<string, string> }> = []
    let fetchCallCount = 0

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      fetchCallCount++
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({
        headers: Object.fromEntries(req.headers.entries()),
      })

      // First fetch is the SSE setup GET request
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify({ id: 'session-123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      // Subsequent fetches are POST requests
      return new Response(null, { status: 204 })
    }) as typeof fetch

    // Mock EventSource
    const mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    }
    globalThis.EventSource = vi.fn(() => mockEventSource) as any

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const channelMsg = { payload: { typ: 'channel', prc: 'test/channel', data: 'init' } } as any
    await writer.write(channelMsg)

    // Should have made 2 fetch calls: GET for session + POST for message
    expect(fetchCallCount).toBe(2)
    // The POST request should include the session ID header
    expect(requests[1].headers['enkaku-session-id']).toBe('session-123')

    await writer.close()
  })

  test('stream messages trigger SSE connection', async () => {
    let fetchCallCount = 0

    globalThis.fetch = vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify({ id: 'session-456' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    }
    globalThis.EventSource = vi.fn(() => mockEventSource) as any

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const streamMsg = { payload: { typ: 'stream', prc: 'test/stream' } } as any
    await writer.write(streamMsg)

    // SSE setup GET + message POST
    expect(fetchCallCount).toBe(2)

    await writer.close()
  })

  test('disposes SSE source on writable close', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ id: 'session-789' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    }
    globalThis.EventSource = vi.fn(() => mockEventSource) as any

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const channelMsg = { payload: { typ: 'channel', prc: 'test/channel', data: 'init' } } as any
    await writer.write(channelMsg)

    // Wait for SSE connection to be established
    await new Promise((resolve) => setTimeout(resolve, 10))

    await writer.close()
    expect(mockEventSource.close).toHaveBeenCalled()
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-client-transport test:unit`
Expected: All tests pass (5 previous + 4 new = 9 total)

**Step 3: Commit**

```bash
git add packages/http-client-transport/test/lib.test.ts
git commit -m "test(http-client-transport): add SSE session and channel/stream routing tests (T-04)"
```

---

## Task 8: http-client-transport — SSE Message Reception and ClientTransport Class Tests

**Files:**
- Modify: `packages/http-client-transport/test/lib.test.ts`

**Step 1: Add SSE message reception and ClientTransport tests**

Append to `packages/http-client-transport/test/lib.test.ts`:

```typescript
describe('createTransportStream() SSE message reception', () => {
  let originalFetch: typeof globalThis.fetch
  let originalEventSource: typeof globalThis.EventSource

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalEventSource = globalThis.EventSource
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.EventSource = originalEventSource
  })

  test('enqueues SSE messages to readable stream', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ id: 'sse-test' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const listeners: Record<string, Array<(event: any) => void>> = {}
    const mockEventSource = {
      addEventListener: vi.fn((type: string, handler: (event: any) => void) => {
        if (listeners[type] == null) {
          listeners[type] = []
        }
        listeners[type].push(handler)
      }),
      close: vi.fn(),
    }
    globalThis.EventSource = vi.fn(() => mockEventSource) as any

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    // Trigger SSE connection by sending a channel message
    const writer = stream.writable.getWriter()
    const channelMsg = { payload: { typ: 'channel', prc: 'test/channel', data: 'init' } } as any
    await writer.write(channelMsg)

    // Wait for the SSE connection promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Simulate SSE message from server
    const serverMsg = { payload: { typ: 'result', val: 'sse-data' } }
    for (const handler of listeners.message ?? []) {
      handler({ data: JSON.stringify(serverMsg) })
    }

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual(serverMsg)

    await writer.close()
  })
})

describe('ClientTransport', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('creates a transport that sends messages via HTTP', async () => {
    const responsePayload = { payload: { typ: 'result', val: 'ok' } }

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const { ClientTransport } = await import('../src/index.js')
    const transport = new ClientTransport<Protocol>({ url: 'http://localhost/rpc' })

    const requestMsg = { payload: { typ: 'request', prc: 'test/request' } } as any
    await transport.write(requestMsg)

    const result = await transport.read()
    expect(result.value).toEqual(responsePayload)

    await transport.dispose()
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-client-transport test:unit`
Expected: All tests pass (9 previous + 2 new = 11 total)

**Step 3: Commit**

```bash
git add packages/http-client-transport/test/lib.test.ts
git commit -m "test(http-client-transport): add SSE message reception and ClientTransport tests (T-04)"
```

---

## Task 9: Update Security Audit Status and Run Full Test Suite

**Files:**
- Modify: `docs/plans/2026-01-28-security-audit.md`

**Step 1: Run all three new test suites**

Run: `pnpm --filter @enkaku/message-transport --filter @enkaku/socket-transport --filter @enkaku/http-client-transport test:unit`
Expected: All tests pass across all three packages

**Step 2: Run the full project test suite to ensure no regressions**

Run: `pnpm run test`
Expected: All existing tests continue to pass, plus the new transport tests

**Step 3: Update the security audit document**

In `docs/plans/2026-01-28-security-audit.md`, update T-04 status:

Change the line:
```
- **Status:** [ ] Not Started
```
under T-04 to:
```
- **Status:** [x] Fixed — message-transport (8 tests), socket-transport (9 tests), http-client-transport (11 tests)
```

Update the Coverage Summary table for the three packages:
- `@enkaku/http-client-transport`: from `0 | 0%` to `1 | ~70%`
- `@enkaku/socket-transport`: from `0 | 0%` to `1 | ~80%`
- `@enkaku/message-transport`: from `0 | 0%` to `1 | ~80%`

Update the Test Priority Matrix:
```
3. [x] T-04: Transport package test suites — DONE
```

**Step 4: Commit**

```bash
git add docs/plans/2026-01-28-security-audit.md
git commit -m "docs: update security audit with transport test coverage (T-04)"
```

---

## Summary

| Task | Package | Tests Added | Focus |
|------|---------|-------------|-------|
| 1 | message-transport | 3 | Stream creation, message flow |
| 2 | message-transport | 5 | Source resolution, Transport class |
| 3 | socket-transport | 5 | Socket connection, JSON-lines, factory source |
| 4 | socket-transport | 4 | Transport class, error handling |
| 5 | http-client-transport | 2 | ResponseError class |
| 6 | http-client-transport | 3 | Fetch-based message routing |
| 7 | http-client-transport | 4 | SSE session, channel/stream routing |
| 8 | http-client-transport | 2 | SSE message reception, ClientTransport |
| 9 | (all) | — | Full test run, audit update |

**Total: ~28 new tests across 3 packages**

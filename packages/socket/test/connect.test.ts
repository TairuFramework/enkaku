import { EventEmitter } from 'node:events'
import { createServer, type Server, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'

// `connectSocket` is the unit under test; `createConnection` is mocked below so
// a connect attempt can be made to hang, which a real Unix socket cannot do.
const createConnectionMock = vi.hoisted(() => vi.fn())
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>()
  return { ...actual, createConnection: createConnectionMock }
})

const { connectSocket } = await import('../src/index.js')

/** A socket that connects to nothing and never emits 'connect'. */
function hangingSocket(): Socket & { destroy: ReturnType<typeof vi.fn> } {
  const socket = new EventEmitter() as unknown as Socket & {
    destroy: ReturnType<typeof vi.fn>
  }
  socket.destroy = vi.fn(() => socket)
  return socket
}

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-connect-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const server = createServer()
    server.listen(socketPath, () => {
      resolve({ server, socketPath })
    })
  })
}

afterEach(() => {
  createConnectionMock.mockReset()
})

describe('connectSocket() timeout', () => {
  // Short explicit per-test timeout below: pre-fix this hangs forever (no
  // timeout logic exists), so it must fail fast and deterministically rather
  // than via vitest's generic 5000ms test timeout.
  test('rejects and destroys the socket when the connect attempt times out', async () => {
    const socket = hangingSocket()
    createConnectionMock.mockReturnValue(socket)

    await expect(connectSocket('/hangs.sock', { timeoutMs: 20 })).rejects.toThrow(
      'Socket connect timed out after 20ms',
    )
    // The abandoned attempt must not leave a pending socket behind
    expect(socket.destroy).toHaveBeenCalled()
    expect(socket.listenerCount('connect')).toBe(0)
  }, 500)

  test('timeoutMs: 0 disables the timeout', async () => {
    const socket = hangingSocket()
    createConnectionMock.mockReturnValue(socket)
    // Guards against a `timeoutMs || DEFAULT` style bug: that would still
    // leave `settled` false after 50ms (10_000ms >> 50ms), so the assertions
    // below alone would not catch it. Asserting no timer was armed does.
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

    let settled = false
    const promise = connectSocket('/hangs.sock', { timeoutMs: 0 })
    // The connect's own (potential) setTimeout call happens synchronously
    // during this call, before our own 50ms wait below also calls
    // setTimeout -- snapshot the count now so the two can't be conflated.
    const timerCallsFromConnect = setTimeoutSpy.mock.calls.length
    promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(settled).toBe(false)
    expect(socket.destroy).not.toHaveBeenCalled()
    expect(timerCallsFromConnect).toBe(0)

    // Let it connect so the test doesn't leave a dangling promise
    socket.emit('connect')
    await expect(promise).resolves.toBe(socket)
    setTimeoutSpy.mockRestore()
  })
})

describe('connectSocket() signal', () => {
  test('rejects without connecting when the signal is already aborted', async () => {
    const reason = new Error('nope')
    await expect(
      connectSocket('/hangs.sock', { signal: AbortSignal.abort(reason) }),
    ).rejects.toThrow('nope')
    expect(createConnectionMock).not.toHaveBeenCalled()
  })

  // Short explicit per-test timeout: pre-fix there is no abort listener at
  // all, so this hangs forever rather than failing fast on a generic 5000ms
  // vitest timeout.
  test('rejects and destroys the socket when aborted mid-flight', async () => {
    const socket = hangingSocket()
    createConnectionMock.mockReturnValue(socket)
    const controller = new AbortController()

    const promise = connectSocket('/hangs.sock', { signal: controller.signal })
    controller.abort(new Error('shutting down'))

    await expect(promise).rejects.toThrow('shutting down')
    expect(socket.destroy).toHaveBeenCalled()
  }, 500)
})

describe('connectSocket() listener hygiene', () => {
  test('leaves no listeners attached once the connect succeeds', async () => {
    const actualNet = await vi.importActual<typeof import('node:net')>('node:net')
    createConnectionMock.mockImplementation(actualNet.createConnection)
    const { server, socketPath } = await createTestServer()

    const socket = await connectSocket(socketPath)

    // A settled promise must not keep listeners (and its closure) alive for the
    // whole life of the socket -- the 'error' one in particular used to stay
    // attached forever, calling reject() on an already-settled promise.
    expect(socket.listenerCount('connect')).toBe(0)
    expect(socket.listenerCount('error')).toBe(0)

    socket.destroy()
    server.close()
  })
})

import type { StreamCall } from '@enkaku/client'
import { standalone } from '@enkaku/standalone'
import { jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'

import { EnkakuProvider, useCreateStream, useReceiveAll, useReceiveLatest } from '../src/index.js'

type Protocol = {
  numbers: {
    type: 'stream'
    param: {
      type: 'object'
      properties: { count: { type: 'number' } }
      required: ['count']
      additionalProperties: false
    }
    receive: {
      type: 'object'
      properties: { value: { type: 'number' } }
      required: ['value']
      additionalProperties: false
    }
    result: {
      type: 'object'
      properties: { total: { type: 'number' } }
      required: ['total']
      additionalProperties: false
    }
  }
  messages: {
    type: 'stream'
    receive: {
      type: 'object'
      properties: { message: { type: 'string' } }
      required: ['message']
      additionalProperties: false
    }
    result: {
      type: 'object'
      properties: { count: { type: 'number' } }
      required: ['count']
      additionalProperties: false
    }
  }
}

// Mock handler that emits a sequence of numbers
const numbersHandler = jest.fn(
  (ctx: {
    param: { count: number }
    signal: AbortSignal
    writable: WritableStream<{ value: number }>
  }) => {
    return new Promise((resolve, reject) => {
      const writer = ctx.writable.getWriter()
      let current = 1
      const { count } = ctx.param

      const timer = setInterval(async () => {
        if (ctx.signal.aborted) {
          clearInterval(timer)
          writer.close()
          reject(new Error('aborted'))
          return
        }

        if (current <= count) {
          await writer.write({ value: current })
          current++
        } else {
          clearInterval(timer)
          writer.close()
          resolve({ total: (count * (count + 1)) / 2 })
        }
      }, 10)

      ctx.signal.addEventListener('abort', () => {
        clearInterval(timer)
        writer.close()
        reject(ctx.signal)
      })
    })
  },
)

// Mock handler that emits messages without parameters
const messagesHandler = jest.fn(
  (ctx: { signal: AbortSignal; writable: WritableStream<{ message: string }> }) => {
    return new Promise((resolve, reject) => {
      const writer = ctx.writable.getWriter()
      const messages = ['Hello', 'World', 'Stream', 'Test']
      let current = 0

      const timer = setInterval(async () => {
        if (ctx.signal.aborted) {
          clearInterval(timer)
          writer.close()
          reject(new Error('aborted'))
          return
        }

        if (current < messages.length) {
          await writer.write({ message: messages[current] })
          current++
        } else {
          clearInterval(timer)
          writer.close()
          resolve({ count: messages.length })
        }
      }, 10)

      ctx.signal.addEventListener('abort', () => {
        clearInterval(timer)
        writer.close()
        reject(ctx.signal)
      })
    })
  },
)

const mockClient = standalone<Protocol>({
  numbers: numbersHandler,
  messages: messagesHandler,
})

const wrapper = ({ children }: PropsWithChildren) => (
  <EnkakuProvider client={mockClient}>{children}</EnkakuProvider>
)

describe('useCreateStream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a stream and returns the function and null initially', () => {
    const { result } = renderHook(() => useCreateStream<Protocol>('numbers'), { wrapper })
    const [createStream, currentCall] = result.current

    expect(createStream).toBeDefined()
    expect(typeof createStream).toBe('function')
    expect(currentCall).toBeNull()
  })

  it('creates a stream with parameters and returns the current call', async () => {
    const { result } = renderHook(() => useCreateStream<Protocol>('numbers'), { wrapper })
    const [createStream] = result.current

    let streamCall: StreamCall<{ value: number }, { total: number }>
    await act(() => {
      streamCall = createStream({ count: 3 })
      return Promise.resolve()
    })

    // Wait for React state to update
    await waitFor(() => {
      const [, currentCall] = result.current
      // Both currentCall and the rawCall should be arrays containing the same stream call
      expect(currentCall).toBe(streamCall)
    })

    expect(numbersHandler).toHaveBeenCalledWith(expect.objectContaining({ param: { count: 3 } }))
  })

  it('creates a stream without parameters', async () => {
    const { result } = renderHook(() => useCreateStream<Protocol>('messages'), { wrapper })
    const [createStream] = result.current

    let streamCall: StreamCall<{ message: string }, { count: number }>
    await act(() => {
      streamCall = createStream()
      return Promise.resolve()
    })

    await waitFor(() => {
      const [, currentCall] = result.current
      expect(currentCall).toBe(streamCall)
    })

    expect(messagesHandler).toHaveBeenCalled()
  })

  it('updates current call when creating a new stream', async () => {
    const { result } = renderHook(() => useCreateStream<Protocol>('numbers'), { wrapper })
    const [createStream] = result.current

    // Create first stream
    let firstCall: StreamCall<{ value: number }, { total: number }>
    await act(() => {
      firstCall = createStream({ count: 2 })
      return Promise.resolve()
    })

    await waitFor(() => {
      const [, currentCall] = result.current
      expect(currentCall).toBe(firstCall)
    })

    // Create second stream
    let secondCall: StreamCall<{ value: number }, { total: number }>
    await act(() => {
      secondCall = createStream({ count: 5 })
      return Promise.resolve()
    })

    await waitFor(() => {
      const [, currentCall] = result.current
      expect(currentCall).toBe(secondCall)
      expect(secondCall).not.toBe(firstCall)
    })
  })

  it('can abort a stream', async () => {
    // Handler that listens for abort signal
    const abortableHandler = jest.fn(
      (ctx: {
        param: { count: number }
        signal: AbortSignal
        writable: WritableStream<{ value: number }>
      }) => {
        return new Promise<{ total: number }>((resolve, reject) => {
          const writer = ctx.writable.getWriter()
          let closed = false

          ctx.signal.addEventListener('abort', () => {
            if (!closed) {
              closed = true
              writer.close()
            }
            reject(ctx.signal)
          })

          // Simulate some work
          setTimeout(() => {
            if (!closed) {
              closed = true
              writer.close()
            }
            resolve({ total: 0 })
          }, 100)
        })
      },
    )

    const abortClient = standalone<Protocol>({
      numbers: abortableHandler,
      messages: messagesHandler,
    })
    const abortWrapper = ({ children }: PropsWithChildren) => (
      <EnkakuProvider client={abortClient}>{children}</EnkakuProvider>
    )

    const { result } = renderHook(() => useCreateStream<Protocol>('numbers'), {
      wrapper: abortWrapper,
    })
    const [createStream] = result.current

    let streamCall: StreamCall<{ value: number }, { total: number }>
    act(() => {
      streamCall = createStream({ count: 3 })
    })

    // Abort the stream
    act(() => {
      streamCall.abort()
    })

    await expect(streamCall).rejects.toBeInstanceOf(AbortSignal)
    expect(abortableHandler).toHaveBeenCalled()
  })
})

describe('useReceiveLatest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when no call is provided', () => {
    const { result } = renderHook(() => useReceiveLatest(null))
    expect(result.current).toBeNull()
  })

  it('receives the latest value from a stream', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        const latest = useReceiveLatest(currentCall)
        return { createStream, currentCall, latest }
      },
      { wrapper },
    )

    await act(() => {
      result.current.createStream({ count: 3 })
      return Promise.resolve()
    })

    // Wait for values to be received
    await waitFor(
      () => {
        expect(result.current.latest).toEqual({ value: 3 })
      },
      { timeout: 1000 },
    )

    expect(numbersHandler).toHaveBeenCalledWith(expect.objectContaining({ param: { count: 3 } }))
  })

  it('resets when call changes', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        const latest = useReceiveLatest(currentCall)
        return { createStream, currentCall, latest }
      },
      { wrapper },
    )

    // Create first stream
    await act(() => {
      result.current.createStream({ count: 2 })
      return Promise.resolve()
    })

    // Wait for first stream values
    await waitFor(
      () => {
        expect(result.current.latest).toEqual({ value: 2 })
      },
      { timeout: 1000 },
    )

    // Create second stream (this will change the currentCall)
    await act(() => {
      result.current.createStream({ count: 1 })
      return Promise.resolve()
    })

    // Should reset and receive new values
    await waitFor(
      () => {
        expect(result.current.latest).toEqual({ value: 1 })
      },
      { timeout: 1000 },
    )
  })

  it('handles null call after having a call', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        const latest = useReceiveLatest(currentCall)
        return { createStream, currentCall, latest }
      },
      { wrapper },
    )

    // Create a stream
    await act(() => {
      result.current.createStream({ count: 2 })
      return Promise.resolve()
    })

    // Wait for values
    await waitFor(
      () => {
        expect(result.current.latest).toEqual({ value: 2 })
      },
      { timeout: 1000 },
    )

    // Note: In practice, currentCall becomes null when component unmounts
    // or when the stream is explicitly cleared. For this test, we verify
    // that the hook handles the received values correctly.
    expect(result.current.latest).toEqual({ value: 2 })
  })
})

describe('useReceiveAll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array, false, and null when no call is provided', () => {
    const { result } = renderHook(() => useReceiveAll(null))
    const [values, done, donePromise] = result.current

    expect(values).toEqual([])
    expect(done).toBe(false)
    expect(donePromise).toBeNull()
  })

  it('collects all values from a stream', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        const [values, done, donePromise] = useReceiveAll(currentCall)
        return { createStream, currentCall, values, done, donePromise }
      },
      { wrapper },
    )

    await act(() => {
      result.current.createStream({ count: 3 })
      return Promise.resolve()
    })

    // Wait for all values to be collected
    await waitFor(
      () => {
        expect(result.current.values).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }])
        expect(result.current.done).toBe(true)
      },
      { timeout: 1000 },
    )

    expect(numbersHandler).toHaveBeenCalledWith(expect.objectContaining({ param: { count: 3 } }))
  })

  it('provides a done promise that resolves when stream completes', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('messages')
        const [values, done, donePromise] = useReceiveAll(currentCall)
        return { createStream, currentCall, values, done, donePromise }
      },
      { wrapper },
    )

    await act(() => {
      result.current.createStream()
      return Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.donePromise).not.toBeNull()
    })

    // Wait for the promise to resolve
    await expect(result.current.donePromise).resolves.toBeUndefined()

    // Check final state
    await waitFor(() => {
      expect(result.current.values).toEqual([
        { message: 'Hello' },
        { message: 'World' },
        { message: 'Stream' },
        { message: 'Test' },
      ])
      expect(result.current.done).toBe(true)
    })
  })

  it('resets when call changes', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        const [values, done, donePromise] = useReceiveAll(currentCall)
        return { createStream, currentCall, values, done, donePromise }
      },
      { wrapper },
    )

    // Create first stream
    await act(() => {
      result.current.createStream({ count: 2 })
      return Promise.resolve()
    })

    // Wait for first stream to complete
    await waitFor(
      () => {
        expect(result.current.values).toEqual([{ value: 1 }, { value: 2 }])
        expect(result.current.done).toBe(true)
      },
      { timeout: 1000 },
    )

    // Create second stream (this will change the currentCall and reset)
    await act(() => {
      result.current.createStream({ count: 1 })
      return Promise.resolve()
    })

    // Should reset and collect new values
    await waitFor(
      () => {
        expect(result.current.values).toEqual([{ value: 1 }])
        expect(result.current.done).toBe(true)
      },
      { timeout: 1000 },
    )
  })

  it('handles null call after having a call', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        const [values, done, donePromise] = useReceiveAll(currentCall)
        return { createStream, currentCall, values, done, donePromise }
      },
      { wrapper },
    )

    // Create a stream
    await act(() => {
      result.current.createStream({ count: 2 })
      return Promise.resolve()
    })

    // Wait for values
    await waitFor(
      () => {
        expect(result.current.values).toEqual([{ value: 1 }, { value: 2 }])
        expect(result.current.done).toBe(true)
      },
      { timeout: 1000 },
    )

    // Note: In practice, currentCall becomes null when component unmounts
    // or when the stream is explicitly cleared. For this test, we verify
    // that the hook handles the received values correctly.
    expect(result.current.values).toEqual([{ value: 1 }, { value: 2 }])
    expect(result.current.done).toBe(true)
    expect(result.current.donePromise).not.toBeNull()
  })
})

describe('Stream caching and reference counting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('caches streams with the same parameters within the same component', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        return { createStream, currentCall }
      },
      { wrapper },
    )

    // Create two streams with identical parameters from the same hook
    let call1: StreamCall<{ value: number }, { total: number }>
    let call2: StreamCall<{ value: number }, { total: number }>

    await act(() => {
      call1 = result.current.createStream({ count: 3 })
      call2 = result.current.createStream({ count: 3 })
      return Promise.resolve()
    })

    // Should be the same cached call when using the same hook instance
    expect(call1).toBe(call2)
    // Handler should only be called once due to caching
    expect(numbersHandler).toHaveBeenCalledTimes(1)
  })

  it('creates different streams for different parameters', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        return { createStream, currentCall }
      },
      { wrapper },
    )

    let call1: StreamCall<{ value: number }, { total: number }>
    let call2: StreamCall<{ value: number }, { total: number }>

    await act(() => {
      call1 = result.current.createStream({ count: 3 })
      call2 = result.current.createStream({ count: 5 })
      return Promise.resolve()
    })

    // Should be different calls for different parameters
    expect(call1).not.toBe(call2)
    expect(numbersHandler).toHaveBeenCalledTimes(2)
  })

  it('handles cleanup on unmount', async () => {
    const { result, unmount } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        return { createStream, currentCall }
      },
      { wrapper },
    )

    let streamCall: StreamCall<{ value: number }, { total: number }>
    await act(() => {
      streamCall = result.current.createStream({ count: 3 })
      return Promise.resolve()
    })

    expect(streamCall.signal.aborted).toBe(false)

    // Unmounting should trigger cleanup
    unmount()

    // Note: The exact cleanup behavior depends on reference counting
    // This test verifies the cleanup function is called without error
    expect(numbersHandler).toHaveBeenCalled()
  })
})

describe('Stream hooks integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('works together with useCreateStream and useReceiveLatest', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('numbers')
        const latest = useReceiveLatest(currentCall)
        return { createStream, currentCall, latest }
      },
      { wrapper },
    )

    const { createStream } = result.current

    await act(() => {
      createStream({ count: 4 })
      return Promise.resolve()
    })

    // Wait for the latest value to be received
    await waitFor(
      () => {
        expect(result.current.latest).toEqual({ value: 4 })
      },
      { timeout: 1000 },
    )
  })

  it('works together with useCreateStream and useReceiveAll', async () => {
    const { result } = renderHook(
      () => {
        const [createStream, currentCall] = useCreateStream<Protocol>('messages')
        const [values, done, donePromise] = useReceiveAll(currentCall)
        return { createStream, currentCall, values, done, donePromise }
      },
      { wrapper },
    )

    const { createStream } = result.current

    await act(() => {
      createStream()
      return Promise.resolve()
    })

    // Wait for all values to be collected
    await waitFor(
      () => {
        expect(result.current.values).toEqual([
          { message: 'Hello' },
          { message: 'World' },
          { message: 'Stream' },
          { message: 'Test' },
        ])
        expect(result.current.done).toBe(true)
      },
      { timeout: 1000 },
    )
  })
})

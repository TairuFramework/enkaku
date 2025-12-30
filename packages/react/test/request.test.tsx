import type { RequestCall } from '@enkaku/client'
import { standalone } from '@enkaku/standalone'
import { vi } from 'vitest'
import '@testing-library/jest-dom'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { type PropsWithChildren, Suspense, use } from 'react'

import { EnkakuProvider, useRequest, useRequestResult, useSendRequest } from '../src/index.js'

type Protocol = {
  test: {
    type: 'request'
    param: {
      type: 'object'
      properties: { message: { type: 'string' } }
      required: ['message']
      additionalProperties: false
    }
    result: {
      type: 'object'
      properties: { ok: { type: 'boolean' } }
      required: ['ok']
      additionalProperties: false
    }
  }
}
const mockHandler = vi.fn(() => ({ ok: true }))
const mockClient = standalone<Protocol>({ test: mockHandler })

const wrapper = ({ children }: PropsWithChildren) => (
  <EnkakuProvider client={mockClient}>{children}</EnkakuProvider>
)

describe('useSendRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the request and returns the result', async () => {
    const { result } = renderHook(() => useSendRequest<Protocol>('test'), { wrapper })
    const [sendRequest] = result.current
    expect(sendRequest).toBeDefined()

    const reply = await act(() => sendRequest({ message: 'Hello, world!' }))
    expect(reply).toEqual({ ok: true })
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ param: { message: 'Hello, world!' } }),
    )
  })

  it('returns the current call', async () => {
    const { result } = renderHook(() => useSendRequest<Protocol>('test'), { wrapper })
    const [sendRequest, currentCallBefore] = result.current
    expect(currentCallBefore).toBeNull()

    let callFromSend: RequestCall<{ ok: boolean }>
    await act(() => {
      callFromSend = sendRequest({ message: 'Check current call' })
      return callFromSend
    })

    // Wait for React state to update
    await waitFor(() => {
      const [, currentCall] = result.current
      expect(currentCall).toBe(callFromSend)
    })
  })

  it('can cancel the call', async () => {
    // Handler that never resolves, but listens for abort
    type HandlerContext = { param: { message?: string }; signal: AbortSignal }
    const abortableHandler = vi.fn((ctx: HandlerContext) => {
      return new Promise<{ ok: boolean }>((_resolve, reject) => {
        ctx.signal.addEventListener('abort', () => {
          reject(ctx.signal)
        })
      })
    })
    const abortClient = standalone<Protocol>({ test: abortableHandler })
    const abortWrapper = ({ children }: PropsWithChildren) => (
      <EnkakuProvider client={abortClient}>{children}</EnkakuProvider>
    )
    const { result } = renderHook(() => useSendRequest<Protocol>('test'), { wrapper: abortWrapper })
    const [sendRequest] = result.current

    let call: RequestCall<{ ok: boolean }> | undefined
    await act(() => {
      call = sendRequest({ message: 'Cancel me' })
      return Promise.resolve()
    })
    // Abort the request
    act(() => {
      call?.abort()
    })

    // The promise should reject with an AbortSignal
    await expect(call).rejects.toBeInstanceOf(AbortSignal)
    expect(abortableHandler).toHaveBeenCalled()
  })
})

describe('useRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the request immediately and returns the result', async () => {
    const { result } = renderHook(() => useRequest<Protocol>('test', { message: 'Immediate' }), {
      wrapper,
    })
    const call = result.current
    expect(call).toBeDefined()
    await expect(call).resolves.toEqual({ ok: true })
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ param: { message: 'Immediate' } }),
    )
  })

  it('re-issues the request when parameters change', async () => {
    const { result, rerender } = renderHook(
      ({ message }) => useRequest<Protocol>('test', { message }),
      { wrapper, initialProps: { message: 'First' } },
    )
    const firstCall = result.current
    await expect(firstCall).resolves.toEqual({ ok: true })
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ param: { message: 'First' } }),
    )
    rerender({ message: 'Second' })
    const secondCall = result.current
    await expect(secondCall).resolves.toEqual({ ok: true })
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ param: { message: 'Second' } }),
    )
    expect(secondCall).not.toBe(firstCall)
  })

  it('can abort the call', async () => {
    type HandlerContext = { param: { message?: string }; signal: AbortSignal }
    const abortableHandler = vi.fn((ctx: HandlerContext) => {
      return new Promise<{ ok: boolean }>((_resolve, reject) => {
        ctx.signal.addEventListener('abort', () => {
          reject(ctx.signal)
        })
      })
    })
    const abortClient = standalone<Protocol>({ test: abortableHandler })
    const abortWrapper = ({ children }: PropsWithChildren) => (
      <EnkakuProvider client={abortClient}>{children}</EnkakuProvider>
    )
    const { result } = renderHook(() => useRequest<Protocol>('test', { message: 'Abort me' }), {
      wrapper: abortWrapper,
    })
    const call = result.current
    act(() => {
      call.abort()
    })
    await expect(call).rejects.toBeInstanceOf(AbortSignal)
    expect(abortableHandler).toHaveBeenCalled()
  })

  it('handles handler errors', async () => {
    const errorHandler = vi.fn(() => {
      throw new Error('Handler error')
    })
    const errorClient = standalone<Protocol>({ test: errorHandler })
    const errorWrapper = ({ children }: PropsWithChildren) => (
      <EnkakuProvider client={errorClient}>{children}</EnkakuProvider>
    )

    const { result } = renderHook(() => useRequest<Protocol>('test', { message: 'Error' }), {
      wrapper: errorWrapper,
    })

    await expect(result.current).rejects.toThrow('Handler error')
    expect(errorHandler).toHaveBeenCalled()
  })

  it('can be used with use() to suspend', async () => {
    const Request = () => {
      const request = useRequest<Protocol>('test', { message: 'Suspend' })
      const result = use(request)
      return <span data-testid="result">{result.ok ? 'OK' : 'Error'}</span>
    }

    const { getByTestId } = await act(async () =>
      render(
        <Suspense fallback={<span>Loading...</span>}>
          <Request />
        </Suspense>,
        { wrapper },
      ),
    )

    await waitFor(() => {
      expect(getByTestId('result')).toHaveTextContent('OK')
    })
  })
})

describe('useResult', () => {
  it('suspends to return the result', async () => {
    const Result = () => {
      const result = useRequestResult<Protocol>('test', { message: 'Suspend' })
      return <span data-testid="result">{result.ok ? 'OK' : 'Error'}</span>
    }

    const { getByTestId } = await act(async () =>
      render(
        <Suspense fallback={<span>Loading...</span>}>
          <Result />
        </Suspense>,
        { wrapper },
      ),
    )

    await waitFor(() => {
      expect(getByTestId('result')).toHaveTextContent('OK')
    })
  })
})

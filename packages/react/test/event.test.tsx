import { standalone } from '@enkaku/standalone'
import { act, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EnkakuProvider, useSendEvent } from '../src/index.js'

type Protocol = {
  test: {
    type: 'event'
    data: { type: 'object'; properties: { message: { type: 'string' } } }
  }
}
const mockHandler = vi.fn()
const mockClient = standalone<Protocol>({ test: mockHandler })

const wrapper = ({ children }: PropsWithChildren) => (
  <EnkakuProvider client={mockClient}>{children}</EnkakuProvider>
)

describe('useSendEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the event', async () => {
    const { result } = renderHook(() => useSendEvent<Protocol>('test'), { wrapper })
    const sendEvent = result.current
    expect(sendEvent).toBeDefined()

    await act(async () => {
      await sendEvent({ data: { message: 'Hello, world!' } })
    })
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ data: { message: 'Hello, world!' } }),
    )
  })
})

import { standalone } from '@enkaku/standalone'
import { jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'

import { EnkakuProvider, useSendEvent } from '../src/index.js'

type Protocol = {
  test: {
    type: 'event'
    data: { type: 'object'; properties: { message: { type: 'string' } } }
  }
}
const mockHandler = jest.fn()
const mockClient = standalone<Protocol>({ test: mockHandler })

const wrapper = ({ children }: PropsWithChildren) => (
  <EnkakuProvider client={mockClient}>{children}</EnkakuProvider>
)

describe('useSendEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends the event', async () => {
    const { result } = renderHook(() => useSendEvent<Protocol>('test'), { wrapper })
    const sendEvent = result.current
    expect(sendEvent).toBeDefined()

    await act(async () => {
      await sendEvent({ message: 'Hello, world!' })
    })
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ data: { message: 'Hello, world!' } }),
    )
  })
})

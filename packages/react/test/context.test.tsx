import type { Client } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EnkakuProvider, useEnkakuClient } from '../src/index.js'

const mockClient = {
  request: vi.fn(),
  sendEvent: vi.fn(),
  createStream: vi.fn(),
  createChannel: vi.fn(),
} as unknown as Client<ProtocolDefinition>

function TestComponent() {
  const client = useEnkakuClient()
  return <div data-testid="client">{client ? 'OK' : 'no client'}</div>
}

describe('EnkakuProvider', () => {
  it('provides client to children', async () => {
    const { getByTestId } = render(
      <EnkakuProvider client={mockClient}>
        <TestComponent />
      </EnkakuProvider>,
    )
    expect(getByTestId('client')).toHaveTextContent('OK')
  })

  it('throws error when useEnkakuClient is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useEnkakuClient must be used within an EnkakuProvider')

    consoleSpy.mockRestore()
  })
})

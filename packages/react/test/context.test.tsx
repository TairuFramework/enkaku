import type { Client } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

import { EnkakuProvider, useEnkakuClient } from '../src/index.js'

const mockClient = {
  request: jest.fn(),
  sendEvent: jest.fn(),
  createStream: jest.fn(),
  createChannel: jest.fn(),
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
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useEnkakuClient must be used within an EnkakuProvider')

    consoleSpy.mockRestore()
  })
})

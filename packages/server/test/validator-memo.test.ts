import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

const { createValidatorSpy } = vi.hoisted(() => ({ createValidatorSpy: vi.fn() }))

vi.mock('@sozai/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sozai/schema')>()
  createValidatorSpy.mockImplementation(actual.createValidator)
  return { ...actual, createValidator: createValidatorSpy }
})

import { Server } from '../src/index.js'

describe('Server message validator', () => {
  test('reuses the compiled validator across servers sharing a protocol', async () => {
    const protocol = {
      'test/request': { type: 'request', param: { type: 'number' }, result: { type: 'number' } },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const createServer = () => {
      return new Server<Protocol>({
        handlers: { 'test/request': vi.fn() },
        protocol,
        requireAuth: false,
      })
    }
    const first = createServer()
    const second = createServer()

    expect(createValidatorSpy).toHaveBeenCalledTimes(2)
    const [firstSchema, secondSchema] = createValidatorSpy.mock.calls.map((call) => call[0])
    // Same schema object means the @sozai/schema WeakMap cache skips recompilation
    expect(secondSchema).toBe(firstSchema)
    expect(createValidatorSpy.mock.results[1]?.value).toBe(
      createValidatorSpy.mock.results[0]?.value,
    )

    await Promise.all([first.dispose(), second.dispose()])
  })
})

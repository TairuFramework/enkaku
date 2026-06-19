import type { StoredMessage } from '@enkaku/hub-protocol'
import { describe, expect, test, vi } from 'vitest'

import { HubClientRegistry } from '../src/registry.js'

const DID = 'did:key:alice'

function noopWriter(_message: StoredMessage): void {}

describe('HubClientRegistry', () => {
  test('register is idempotent', () => {
    const registry = new HubClientRegistry()
    const first = registry.register(DID)
    const second = registry.register(DID)
    expect(first).toBe(second)
    expect(first.sendMessage).toBeNull()
  })

  test('setReceiveWriter binds and rejects a double-bind', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    registry.setReceiveWriter(DID, noopWriter)
    expect(registry.isWriterBound(DID)).toBe(true)
    expect(registry.isOnline(DID)).toBe(true)
    expect(() => registry.setReceiveWriter(DID, noopWriter)).toThrow('receive writer already bound')
  })

  test('clearReceiveWriter unbinds', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    registry.setReceiveWriter(DID, noopWriter)
    registry.clearReceiveWriter(DID)
    expect(registry.isWriterBound(DID)).toBe(false)
  })

  test('unregisterIfIdle removes only when no writer is bound', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    registry.setReceiveWriter(DID, noopWriter)
    registry.unregisterIfIdle(DID)
    expect(registry.getClient(DID)).toBeDefined()
    registry.clearReceiveWriter(DID)
    registry.unregisterIfIdle(DID)
    expect(registry.getClient(DID)).toBeUndefined()
  })

  test('getClient exposes the bound writer', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    const writer = vi.fn()
    registry.setReceiveWriter(DID, writer)
    const message: StoredMessage = {
      sequenceID: '1',
      senderDID: 'did:key:bob',
      topicID: 'topic:1',
      payload: new Uint8Array([1]),
    }
    registry.getClient(DID)?.sendMessage?.(message)
    expect(writer).toHaveBeenCalledWith(message)
  })
})

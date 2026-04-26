import { describe, expect, test, vi } from 'vitest'

import { HubClientRegistry } from '../src/registry.js'

describe('HubClientRegistry', () => {
  test('register creates client entry', () => {
    const registry = new HubClientRegistry()
    const entry = registry.register('did:key:alice')
    expect(entry.did).toBe('did:key:alice')
    expect(entry.groups.size).toBe(0)
    expect(entry.sendMessage).toBeNull()
  })

  test('register is idempotent', () => {
    const registry = new HubClientRegistry()
    const entry1 = registry.register('did:key:alice')
    const entry2 = registry.register('did:key:alice')
    expect(entry1).toBe(entry2)
  })

  test('unregister removes client and cleans up groups', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.joinGroup('did:key:alice', 'group-1')
    registry.unregister('did:key:alice')
    expect(registry.getClient('did:key:alice')).toBeUndefined()
    expect(registry.getOnlineGroupMembers('group-1')).toEqual([])
  })

  test('setReceiveWriter and clearReceiveWriter', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    const writer = vi.fn()
    registry.setReceiveWriter('did:key:alice', writer)
    expect(registry.isOnline('did:key:alice')).toBe(true)
    registry.clearReceiveWriter('did:key:alice')
    expect(registry.isOnline('did:key:alice')).toBe(false)
  })

  test('joinGroup and leaveGroup', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.joinGroup('did:key:alice', 'group-1')
    expect(registry.getClient('did:key:alice')?.groups.has('group-1')).toBe(true)
    registry.leaveGroup('did:key:alice', 'group-1')
    expect(registry.getClient('did:key:alice')?.groups.has('group-1')).toBe(false)
  })

  test('getOnlineGroupMembers returns only online members', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.register('did:key:bob')
    registry.joinGroup('did:key:alice', 'group-1')
    registry.joinGroup('did:key:bob', 'group-1')
    registry.setReceiveWriter('did:key:alice', vi.fn())
    expect(registry.getOnlineGroupMembers('group-1')).toEqual(['did:key:alice'])
  })

  test('getGroupMembers returns all members regardless of online status', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.register('did:key:bob')
    registry.joinGroup('did:key:alice', 'group-1')
    registry.joinGroup('did:key:bob', 'group-1')
    expect(registry.getGroupMembers('group-1').sort()).toEqual(['did:key:alice', 'did:key:bob'])
  })

  test('joinGroup throws if client not registered', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.joinGroup('did:key:unknown', 'group-1')).toThrow()
  })

  test('setReceiveWriter throws on double-bind for same DID', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.setReceiveWriter('did:key:alice', vi.fn())
    expect(() => registry.setReceiveWriter('did:key:alice', vi.fn())).toThrow(
      /receive writer already bound/,
    )
  })

  test('setReceiveWriter succeeds again after clearReceiveWriter', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    const first = vi.fn()
    const second = vi.fn()
    registry.setReceiveWriter('did:key:alice', first)
    registry.clearReceiveWriter('did:key:alice')
    expect(() => registry.setReceiveWriter('did:key:alice', second)).not.toThrow()
    expect(registry.isOnline('did:key:alice')).toBe(true)
  })

  test('setReceiveWriter is a no-op for unregistered DID', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.setReceiveWriter('did:key:ghost', vi.fn())).not.toThrow()
    expect(registry.isOnline('did:key:ghost')).toBe(false)
  })
})

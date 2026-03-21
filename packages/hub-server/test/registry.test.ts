import { describe, expect, test, vi } from 'vitest'

import { HubClientRegistry } from '../src/registry.js'

describe('HubClientRegistry', () => {
  test('register creates a new entry', () => {
    const registry = new HubClientRegistry()
    const entry = registry.register('alice')
    expect(entry.did).toBe('alice')
    expect(entry.groups.size).toBe(0)
    expect(entry.sendMessage).toBeNull()
  })

  test('register returns existing entry on re-registration and clears stale state', () => {
    const registry = new HubClientRegistry()
    const entry1 = registry.register('alice')
    const staleWriter = vi.fn()
    entry1.sendMessage = staleWriter
    entry1.tunnelWriters.set('bob', vi.fn())

    const entry2 = registry.register('alice')
    expect(entry2).toBe(entry1)
    expect(entry2.sendMessage).toBeNull()
    expect(entry2.tunnelWriters.size).toBe(0)
  })

  test('unregister removes client from all groups', () => {
    const registry = new HubClientRegistry()
    registry.register('alice')
    registry.joinGroup('alice', 'group-1')
    registry.joinGroup('alice', 'group-2')

    registry.unregister('alice')

    expect(registry.getClient('alice')).toBeUndefined()
    expect(registry.getOnlineGroupMembers('group-1')).toEqual([])
    expect(registry.getOnlineGroupMembers('group-2')).toEqual([])
  })

  test('unregister is a no-op for unknown DID', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.unregister('unknown')).not.toThrow()
  })

  test('unregister deletes empty group entries', () => {
    const registry = new HubClientRegistry()
    registry.register('alice')
    registry.joinGroup('alice', 'solo-group')
    registry.unregister('alice')

    // Re-register and join — should work without leftover state
    registry.register('bob')
    registry.joinGroup('bob', 'solo-group')
    expect(registry.getOnlineGroupMembers('solo-group')).toEqual([])
    registry.setReceiveWriter('bob', vi.fn())
    expect(registry.getOnlineGroupMembers('solo-group')).toEqual(['bob'])
  })

  test('joinGroup throws when client is not registered', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.joinGroup('unknown', 'group')).toThrow('Client unknown is not registered')
  })

  test('leaveGroup deletes group entry when last member leaves', () => {
    const registry = new HubClientRegistry()
    registry.register('alice')
    registry.joinGroup('alice', 'temp-group')
    registry.leaveGroup('alice', 'temp-group')

    expect(registry.getOnlineGroupMembers('temp-group')).toEqual([])

    // Verify no leak — joining again works cleanly
    registry.joinGroup('alice', 'temp-group')
    registry.setReceiveWriter('alice', vi.fn())
    expect(registry.getOnlineGroupMembers('temp-group')).toEqual(['alice'])
  })

  test('leaveGroup is a no-op for unregistered client', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.leaveGroup('unknown', 'group')).not.toThrow()
  })

  test('getOnlineGroupMembers excludes clients without sendMessage', () => {
    const registry = new HubClientRegistry()
    registry.register('alice')
    registry.register('bob')
    registry.joinGroup('alice', 'group')
    registry.joinGroup('bob', 'group')

    // Neither has a writer — both offline
    expect(registry.getOnlineGroupMembers('group')).toEqual([])

    // Only Alice has a writer
    registry.setReceiveWriter('alice', vi.fn())
    expect(registry.getOnlineGroupMembers('group')).toEqual(['alice'])

    // Both have writers
    registry.setReceiveWriter('bob', vi.fn())
    const members = registry.getOnlineGroupMembers('group')
    expect(members).toContain('alice')
    expect(members).toContain('bob')
    expect(members).toHaveLength(2)
  })

  test('getOnlineGroupMembers returns empty for unknown group', () => {
    const registry = new HubClientRegistry()
    expect(registry.getOnlineGroupMembers('nonexistent')).toEqual([])
  })

  test('isOnline returns false for unknown DID', () => {
    const registry = new HubClientRegistry()
    expect(registry.isOnline('unknown')).toBe(false)
  })

  test('isOnline reflects sendMessage state', () => {
    const registry = new HubClientRegistry()
    registry.register('alice')
    expect(registry.isOnline('alice')).toBe(false)

    registry.setReceiveWriter('alice', vi.fn())
    expect(registry.isOnline('alice')).toBe(true)

    registry.clearReceiveWriter('alice')
    expect(registry.isOnline('alice')).toBe(false)
  })

  test('setReceiveWriter is a no-op for unregistered client', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.setReceiveWriter('unknown', vi.fn())).not.toThrow()
  })

  test('tunnel write/clear/send round-trip', () => {
    const registry = new HubClientRegistry()
    registry.register('alice')
    registry.register('bob')

    const received: Array<{ data: string }> = []
    registry.setTunnelWriter('bob', 'alice', (data) => received.push(data))

    registry.sendTunnelData('bob', 'alice', { data: 'tunnel-msg' })
    expect(received).toEqual([{ data: 'tunnel-msg' }])

    registry.clearTunnelWriter('bob', 'alice')
    registry.sendTunnelData('bob', 'alice', { data: 'should-be-dropped' })
    expect(received).toHaveLength(1)
  })

  test('sendTunnelData is a no-op when no tunnel writer exists', () => {
    const registry = new HubClientRegistry()
    registry.register('alice')
    expect(() => registry.sendTunnelData('alice', 'bob', { data: 'nope' })).not.toThrow()
  })
})

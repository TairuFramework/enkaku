import { fromUTF } from '@sozai/codec'
import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'

describe('createMemoryBus', () => {
  test('fans a publish out to all subscribers of the topic', () => {
    const bus = createMemoryBus()
    const a: Array<string> = []
    const b: Array<string> = []
    bus.subscribe('t1', (p) => a.push(new TextDecoder().decode(p)))
    bus.subscribe('t1', (p) => b.push(new TextDecoder().decode(p)))

    bus.publish('t1', fromUTF('hello'))

    expect(a).toEqual(['hello'])
    expect(b).toEqual(['hello'])
  })

  test('does not deliver across topics', () => {
    const bus = createMemoryBus()
    const received: Array<string> = []
    bus.subscribe('t1', (p) => received.push(new TextDecoder().decode(p)))

    bus.publish('t2', fromUTF('nope'))

    expect(received).toEqual([])
  })

  test('unsubscribe stops delivery', () => {
    const bus = createMemoryBus()
    const received: Array<string> = []
    const unsub = bus.subscribe('t1', (p) => received.push(new TextDecoder().decode(p)))

    bus.publish('t1', fromUTF('first'))
    unsub()
    bus.publish('t1', fromUTF('second'))

    expect(received).toEqual(['first'])
  })
})

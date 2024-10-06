import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  EventActionDefinition,
  RequestActionDefinition,
  RequestActionPayloadOf,
} from '@enkaku/protocol'
import { createDirectTransports } from '@enkaku/transport'

import { Client } from '../src/index.js'

describe('Client()', () => {
  test('sends events and requests', async () => {
    type Definitions = {
      'test/event': EventActionDefinition<{ hello: string }>
      'test/request': RequestActionDefinition<undefined, string>
    }
    type Meta = { test: boolean }

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions, Meta>
    >()

    const client = new Client({ meta: { test: true }, transport: transports.client })

    await client.sendEvent('test/event', { hello: 'world' })
    const eventRead = await transports.server.read()
    expect(eventRead.done).toBe(false)
    expect(eventRead.value).toEqual({
      action: { type: 'event', name: 'test/event', data: { hello: 'world' } },
      meta: { test: true },
    })

    const responsePromise = client.request('test/request')
    const requestRead = await transports.server.read()
    const action = requestRead.value?.action as RequestActionPayloadOf<
      'test/request',
      Definitions['test/request']
    >
    expect(action.name).toBe('test/request')
    await transports.server.write({ action: { type: 'result', id: action.id, value: 'OK' } })
    await expect(responsePromise).resolves.toBe('OK')

    await transports.dispose()
  })
})

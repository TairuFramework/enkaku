import { createConnection } from '@sozai/stream'
import { describe, expect, test, vi } from 'vitest'

import { Transport } from '../src/index.js'

describe('Transport external signal', () => {
  test('aborting params.signal disposes the transport', async () => {
    const [stream] = createConnection<string, string>()
    const controller = new AbortController()
    const transport = new Transport<string, string>({ stream, signal: controller.signal })

    const disposing = vi.fn()
    const disposed = vi.fn()
    transport.events.on('disposing', disposing)
    transport.events.on('disposed', disposed)

    expect(transport.signal.aborted).toBe(false)

    controller.abort()
    await transport.disposed

    // The whole point: an abort on the caller's signal must run the transport's
    // own teardown, not just sit there.
    expect(transport.signal.aborted).toBe(true)
    expect(disposing).toHaveBeenCalledTimes(1)
    expect(disposed).toHaveBeenCalledTimes(1)
  })

  test('the abort reason reaches the disposed event', async () => {
    const [stream] = createConnection<string, string>()
    const controller = new AbortController()
    const transport = new Transport<string, string>({ stream, signal: controller.signal })

    const disposed = vi.fn()
    transport.events.on('disposed', disposed)

    const reason = new Error('caller went away')
    controller.abort(reason)
    await transport.disposed

    expect(disposed).toHaveBeenCalledWith({ reason })
  })
})

import { createConnection } from '@sozai/stream'
import { describe, expect, test, vi } from 'vitest'

import { DirectTransports, Transport } from '../src/index.js'

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

  test('a signal already aborted before construction still disposes the transport', async () => {
    const [stream] = createConnection<string, string>()
    const controller = new AbortController()
    controller.abort()

    const transport = new Transport<string, string>({ stream, signal: controller.signal })

    const disposing = vi.fn()
    const disposed = vi.fn()
    transport.events.on('disposing', disposing)
    transport.events.on('disposed', disposed)

    // The dispose callback runs synchronously inside the Disposer base
    // constructor when the signal is already aborted -- before Transport's
    // own constructor body (and therefore `this`) has finished initializing.
    // If that callback touches `this` too early it throws, Disposer swallows
    // the rejection, and `disposed` resolves without `disposing`/`disposed`
    // ever having fired or the writer ever having been closed. Assert on the
    // actual teardown, not on the absence of a console warning.
    await transport.disposed

    expect(disposing).toHaveBeenCalledTimes(1)
    expect(disposed).toHaveBeenCalledTimes(1)
  })
})

describe('DirectTransports external signal', () => {
  test('a signal already aborted before construction disposes both inner transports', async () => {
    const controller = new AbortController()
    controller.abort()

    const transports = new DirectTransports<string, string>({ signal: controller.signal })

    const clientDisposing = vi.fn()
    const clientDisposed = vi.fn()
    const serverDisposing = vi.fn()
    const serverDisposed = vi.fn()
    transports.client.events.on('disposing', clientDisposing)
    transports.client.events.on('disposed', clientDisposed)
    transports.server.events.on('disposing', serverDisposing)
    transports.server.events.on('disposed', serverDisposed)

    await transports.disposed

    // DirectTransports.dispose() awaits both inner transports' own dispose(),
    // so this also proves each inner Transport actually tore down (emitted
    // both events) rather than DirectTransports' outer dispose merely
    // resolving while the inner transports silently failed to dispose.
    expect(clientDisposing).toHaveBeenCalledTimes(1)
    expect(clientDisposed).toHaveBeenCalledTimes(1)
    expect(serverDisposing).toHaveBeenCalledTimes(1)
    expect(serverDisposed).toHaveBeenCalledTimes(1)
  })
})

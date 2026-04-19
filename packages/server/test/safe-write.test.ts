import { EventEmitter } from '@enkaku/event'
import { describe, expect, test, vi } from 'vitest'

import { safeWrite } from '../src/safe-write.js'
import type { ServerEvents } from '../src/types.js'

function fakeTransport(behaviour: 'ok' | 'closed' | 'boom') {
  return {
    write: vi.fn(async () => {
      if (behaviour === 'closed') {
        throw new TypeError('Invalid state: WritableStream is closed')
      }
      if (behaviour === 'boom') {
        throw new Error('non-benign')
      }
    }),
  }
}

function fakeCtx(overrides: Partial<Record<string, unknown>> = {}) {
  const events = new EventEmitter<ServerEvents>()
  const controllers: Record<string, AbortController> = {}
  const abortController = new AbortController()
  return {
    controllers,
    events,
    logger: {
      debug: () => {},
      trace: () => {},
      warn: () => {},
    } as unknown as import('@enkaku/log').Logger,
    signal: abortController.signal,
    ...overrides,
  }
}

describe('safeWrite', () => {
  test('succeeds and emits nothing on clean write', async () => {
    const transport = fakeTransport('ok') as never
    const ctx = fakeCtx()
    const dropped = vi.fn()
    ctx.events.on('writeDropped', dropped)

    await safeWrite({
      transport,
      payload: { typ: 'result' } as never,
      ctx: ctx as never,
    })

    expect(dropped).not.toHaveBeenCalled()
  })

  test('swallows benign errors when disposing and emits writeDropped', async () => {
    const transport = fakeTransport('closed') as never
    const abortController = new AbortController()
    abortController.abort()
    const ctx = fakeCtx({ signal: abortController.signal })
    const dropped = vi.fn()
    ctx.events.on('writeDropped', dropped)

    await expect(
      safeWrite({
        transport,
        payload: { typ: 'result' } as never,
        rid: 'r1',
        ctx: ctx as never,
      }),
    ).resolves.toBeUndefined()

    expect(dropped).toHaveBeenCalledWith(
      expect.objectContaining({ rid: 'r1', reason: 'disposing' }),
    )
  })

  test("swallows benign errors when controller aborted with 'Close'", async () => {
    const transport = fakeTransport('closed') as never
    const controller = new AbortController()
    controller.abort('Close')
    const ctx = fakeCtx({ controllers: { r1: controller as never } })
    const dropped = vi.fn()
    ctx.events.on('writeDropped', dropped)

    await expect(
      safeWrite({
        transport,
        payload: { typ: 'result' } as never,
        rid: 'r1',
        ctx: ctx as never,
      }),
    ).resolves.toBeUndefined()

    expect(dropped).toHaveBeenCalledWith(expect.objectContaining({ rid: 'r1', reason: 'aborted' }))
  })

  test('does not swallow when controller aborted with a non-benign reason', async () => {
    const transport = fakeTransport('closed') as never
    const controller = new AbortController()
    controller.abort('Timeout')
    const ctx = fakeCtx({ controllers: { r1: controller as never } })
    const writeFailed = vi.fn()
    const dropped = vi.fn()
    ctx.events.on('writeFailed', writeFailed)
    ctx.events.on('writeDropped', dropped)

    await safeWrite({
      transport,
      payload: { typ: 'result' } as never,
      rid: 'r1',
      ctx: ctx as never,
    })

    expect(dropped).not.toHaveBeenCalled()
    expect(writeFailed).toHaveBeenCalledWith(expect.objectContaining({ rid: 'r1' }))
  })

  test('emits writeFailed and aborts the controller on non-benign errors', async () => {
    const transport = fakeTransport('boom') as never
    const controller = new AbortController()
    const ctx = fakeCtx({ controllers: { r1: controller as never } })
    const writeFailed = vi.fn()
    ctx.events.on('writeFailed', writeFailed)

    await safeWrite({
      transport,
      payload: { typ: 'result' } as never,
      rid: 'r1',
      ctx: ctx as never,
    })

    expect(writeFailed).toHaveBeenCalledWith(expect.objectContaining({ rid: 'r1' }))
    expect(controller.signal.aborted).toBe(true)
    expect(controller.signal.reason).toBe('Transport')
  })
})

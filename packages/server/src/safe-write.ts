import { isBenignTeardownError } from '@enkaku/async'
import type { AnyServerPayloadOf, ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'

import type { HandlerContext } from './types.js'

export type SafeWriteParams<Protocol extends ProtocolDefinition> = {
  transport: ServerTransportOf<Protocol>
  payload: AnyServerPayloadOf<Protocol>
  rid?: string
  ctx: HandlerContext<Protocol>
}

/**
 * Send a server payload through the transport, classifying any failure as
 * either a benign teardown (swallowed → `writeDropped` event) or a real
 * transport failure (`writeFailed` event + controller aborted). Never rejects,
 * so callers can fire-and-forget without attaching `.catch`.
 */
export async function safeWrite<Protocol extends ProtocolDefinition>(
  params: SafeWriteParams<Protocol>,
): Promise<void> {
  const { transport, payload, rid, ctx } = params
  try {
    await transport.write(createUnsignedToken(payload) as never)
    return
  } catch (error) {
    const controller = rid != null ? ctx.controllers[rid] : undefined
    const controllerReason = controller?.signal.aborted ? controller.signal.reason : undefined
    const errorBenign = isBenignTeardownError(error)
    const reasonBenign = isBenignTeardownError(controllerReason)
    const disposing = ctx.signal.aborted
    const swallow =
      (errorBenign || reasonBenign) && (disposing || (controller?.signal.aborted && reasonBenign))

    if (swallow) {
      const reason = disposing ? 'disposing' : controller?.signal.aborted ? 'aborted' : 'benign'
      await ctx.events.emit('writeDropped', {
        rid,
        reason,
        error: error as Error,
      })
      return
    }

    await ctx.events.emit('writeFailed', { error: error as Error, rid })
    if (controller != null && !controller.signal.aborted) {
      controller.abort('Transport')
    }
  }
}

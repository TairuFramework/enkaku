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

export async function safeWrite<Protocol extends ProtocolDefinition>(
  params: SafeWriteParams<Protocol>,
): Promise<void> {
  const { transport, payload, rid, ctx } = params
  try {
    await transport.write(createUnsignedToken(payload) as never)
  } catch (error) {
    const controller = rid != null ? ctx.controllers[rid] : undefined
    const controllerReason = controller?.signal.aborted ? controller.signal.reason : undefined
    const errorBenign = isBenignTeardownError(error)
    const reasonBenign = isBenignTeardownError(controllerReason)
    const shouldSwallow =
      (errorBenign || reasonBenign) &&
      (ctx.disposing.value || (controller?.signal.aborted === true && reasonBenign))
    if (shouldSwallow) {
      const dropReason = ctx.disposing.value
        ? 'disposing'
        : controller?.signal.aborted
          ? 'aborted'
          : 'benign'
      await ctx.events.emit('writeDropped', {
        rid,
        reason: dropReason,
        error: error as Error,
      })
      return
    }
    await ctx.events.emit('writeFailed', { error: error as Error, rid })
    if (controller != null && !controller.signal.aborted) {
      controller.abort('Transport')
    }
    throw error
  }
}

import { type BroadcastHandler, type SuppressConfig, suppressible } from '@enkaku/broadcast'
import type { ProtocolDefinition } from '@enkaku/protocol'

export type BusHandlerMaps = {
  eventHandlers: Record<string, (data: unknown, senderDID?: string) => void | Promise<void>>
  requestHandlers: Record<string, BroadcastHandler>
}

/** Minimal bus-path context message: authenticated sender at `payload.iss`. */
function busMessage(senderDID?: string): { payload: { iss?: string } } {
  return { payload: { iss: senderDID } }
}

type LooseHandler = (context: {
  data?: unknown
  param?: unknown
  signal?: AbortSignal
  message: { payload: { iss?: string } }
}) => unknown

/**
 * Adapt native `@enkaku/server` handlers into bus event/request handler maps.
 * `event` procedures become fire-and-forget event handlers; `request` procedures
 * become anycast request handlers (wrapped `suppressible`). `stream`/`channel`
 * and procedures without a handler are omitted — reachable only on the directed
 * inbox server. The authenticated sender is exposed at `ctx.message.payload.iss`.
 */
export function adaptBusHandlers(
  protocol: ProtocolDefinition,
  handlers: Record<string, unknown>,
  suppress: SuppressConfig = {},
): BusHandlerMaps {
  const eventHandlers: BusHandlerMaps['eventHandlers'] = {}
  const requestHandlers: BusHandlerMaps['requestHandlers'] = {}

  for (const [prc, definition] of Object.entries(protocol)) {
    const handler = handlers[prc] as LooseHandler | undefined
    if (handler == null) continue
    if (definition.type === 'event') {
      eventHandlers[prc] = (data, senderDID) =>
        handler({ data, message: busMessage(senderDID) }) as void | Promise<void>
    } else if (definition.type === 'request') {
      const fn: BroadcastHandler = (param, context) => {
        const controller = new AbortController()
        return handler({
          param,
          signal: controller.signal,
          message: busMessage(context?.senderDID),
        })
      }
      requestHandlers[prc] = suppressible(fn, suppress)
    }
  }

  return { eventHandlers, requestHandlers }
}

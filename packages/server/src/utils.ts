import { type AnyServerPayloadOf, ErrorCodes, type ProtocolDefinition } from '@enkaku/protocol'
import { toPromise } from '@sozai/async'
import type { Logger } from '@sozai/log'

import { HandlerError } from './error.js'
import type {
  HandlerContext,
  HandlerController,
  HandlerErrorCategory,
  HandlerErrorMessageType,
  ServerEmitter,
} from './types.js'

export function emitHandlerError(
  events: ServerEmitter,
  category: HandlerErrorCategory,
  error: HandlerError<string>,
  payload: { typ: string } & Record<string, unknown>,
): void {
  events.emit('handlerError', {
    error,
    payload,
    category,
    messageType: payload.typ as HandlerErrorMessageType,
  })
}

export function isRedacted(
  context: { redact?: (procedure: string) => boolean },
  procedure: string | undefined,
): boolean {
  return procedure != null && context.redact?.(procedure) === true
}

/** Error name only: message and cause may carry the payload. */
export function getErrorName(cause: unknown): string | undefined {
  return cause instanceof Error ? cause.name : undefined
}

function canSend(controller: HandlerController | undefined): boolean {
  if (controller == null) {
    return false
  }
  const { signal } = controller
  return !signal.aborted || signal.reason === 'Close'
}

type LogHandlerErrorRedactedParams = {
  logger: Logger
  payload: { typ: string; prc: string; rid: string }
  code: string
  name: string | undefined
  sendable: boolean
}

function logHandlerErrorRedacted(params: LogHandlerErrorRedactedParams): void {
  const { logger, payload, code, name, sendable } = params
  const properties = { type: payload.typ, procedure: payload.prc, rid: payload.rid, code, name }
  logger.warn('handler {procedure} (rid={rid}) threw {name} with code {code}', properties)
  if (sendable) {
    logger.trace('send error to {type} {procedure} with ID {rid}: {code}', properties)
  } else {
    logger.debug(
      'handler error for {type} {procedure} with ID {rid} cannot be sent to client: {code}',
      properties,
    )
  }
}

export type ExecuteHandlerParams<Protocol extends ProtocolDefinition> = {
  context: HandlerContext<Protocol>
  payload: { typ: string; prc: string; rid: string }
  execute: () => unknown
  beforeEnd?: () => Promise<void>
}

export async function executeHandler<Protocol extends ProtocolDefinition>(
  params: ExecuteHandlerParams<Protocol>,
): Promise<void> {
  const { context, payload, execute, beforeEnd } = params
  const controller = context.controllers[payload.rid]
  const redacted = isRedacted(context, payload.prc)
  try {
    const val = await toPromise(execute)
    if (beforeEnd != null) {
      await beforeEnd()
    }
    if (canSend(controller)) {
      if (redacted) {
        context.logger.trace('send result to {type} {procedure} with ID {rid}', {
          type: payload.typ,
          procedure: payload.prc,
          rid: payload.rid,
        })
      } else {
        context.logger.trace('send result to {type} {procedure} with ID {rid}: {result}', {
          type: payload.typ,
          procedure: payload.prc,
          rid: payload.rid,
          result: val,
        })
      }
      await context.send(
        {
          typ: 'result',
          rid: payload.rid,
          val,
        } as unknown as AnyServerPayloadOf<Protocol>,
        { rid: payload.rid },
      )
    }
  } catch (cause) {
    if (beforeEnd != null) {
      await beforeEnd()
    }
    const error = HandlerError.from(cause, {
      code: ErrorCodes.HANDLER_ERROR,
      message: 'Handler execution failed',
    })
    if (redacted) {
      logHandlerErrorRedacted({
        logger: context.logger,
        payload,
        code: error.code,
        name: getErrorName(cause),
        sendable: canSend(controller),
      })
    } else {
      context.logger.warn('handler {procedure} (rid={rid}) threw: {message}', {
        procedure: payload.prc,
        rid: payload.rid,
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      })
    }
    if (canSend(controller)) {
      if (!redacted) {
        context.logger.trace('send error to {type} {procedure} with ID {rid}: {error}', {
          type: payload.typ,
          procedure: payload.prc,
          rid: payload.rid,
          error,
        })
      }
      await context.send(error.toPayload(payload.rid) as AnyServerPayloadOf<Protocol>, {
        rid: payload.rid,
      })
    } else if (!redacted) {
      context.logger.debug(
        'handler error for {type} {procedure} with ID {rid} cannot be sent to client: {error}',
        {
          type: payload.typ,
          procedure: payload.prc,
          rid: payload.rid,
          error,
        },
      )
    }
    emitHandlerError(context.events, 'handler', error, payload)
  } finally {
    delete context.controllers[payload.rid]
  }
}

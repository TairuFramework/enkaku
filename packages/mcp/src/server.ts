import { NodeStreamsTransport } from '@enkaku/node-streams-transport'
import { type Schema, type Validator, createValidator } from '@enkaku/schema'
import type { TransportType } from '@enkaku/transport'

import { RPCError, errorResponse } from './error.js'
import type {
  ProtocolDefinition,
  ResourceHandlers,
  ToPromptHandlers,
  ToToolHandlers,
  ToolHandler,
  ToolHandlerContext,
} from './protocol.js'
import {
  type ClientMessage,
  type ClientNotification,
  type ClientRequest,
  createClientMessage,
} from './schemas/client.js'
import type { Implementation, InitializeResult } from './schemas/initialize.js'
import {
  INVALID_REQUEST,
  LATEST_PROTOCOL_VERSION,
  METHOD_NOT_FOUND,
  type RequestID,
} from './schemas/rpc.js'
import type { ServerMessage, ServerResult } from './schemas/server.js'
import type { CallToolRequest, CallToolResult, Tool } from './schemas/tool.js'

export type ServerTransport = TransportType<ClientMessage, ServerMessage>

export type ServerParams<Protocol extends ProtocolDefinition> = {
  name: string
  version: string
  protocol: Protocol
  transport?: ServerTransport
  resources?: ResourceHandlers
} & (Protocol['prompts'] extends Record<string, unknown>
  ? { prompts: ToPromptHandlers<Protocol['prompts']> }
  : { prompts?: never }) &
  (Protocol['tools'] extends Record<string, unknown>
    ? { tools: ToToolHandlers<Protocol['tools']> }
    : { tools?: never })

function isRequestID(id: unknown): id is RequestID {
  return typeof id === 'string' || typeof id === 'number'
}

const protocol = {
  tools: {
    foo: {
      input: { type: 'object', properties: { bar: { type: 'string' } } },
    },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const params = {
  name: 'test MCP',
  version: '0.1.0',
  protocol,
  tools: {
    foo: ({ input }) => {
      return { content: [{ type: 'text', text: `bar is ${input.bar}` }] }
    },
  },
} satisfies ServerParams<Protocol>

export class ContextServer<Protocol extends ProtocolDefinition> {
  #serverInfo: Implementation
  #toolHandlers: Protocol['tools'] extends Record<string, unknown>
    ? ToToolHandlers<Protocol['tools']>
    : Record<string, never>
  #toolsList: Array<Tool>
  #validator: Validator<ClientMessage>

  constructor(params: ServerParams<Protocol>) {
    this.#serverInfo = { name: params.name, version: params.version }
    // @ts-ignore type instantiation too deep
    this.#toolHandlers = params.tools ?? {}
    this.#toolsList = Object.entries(params.protocol.tools ?? {}).map(([name, tool]) => {
      return { name, description: tool.description, inputSchema: tool.input }
    })
    this.#validator = createValidator(createClientMessage(params.protocol))

    const transport =
      params.transport ??
      new NodeStreamsTransport<ClientMessage, ServerMessage>({
        streams: { readable: process.stdin, writable: process.stdout },
      })
    this.handle(transport)
  }

  handle(transport: ServerTransport) {
    const inflight: Record<string, AbortController> = {}

    const handleNext = async () => {
      const next = await transport.read()
      if (next.done) {
        return
      }

      const id = next.value.id
      const validated = this.#validator(next.value)
      if (validated.isOk()) {
        this.handleMessage(validated.value, inflight).then(
          (result) => {
            if (result != null && isRequestID(id)) {
              transport.write({ jsonrpc: '2.0', id, result })
            }
          },
          (cause) => {
            if (isRequestID(id)) {
              transport.write(errorResponse(id, cause))
            } else {
              // TODO: call optional error handler
            }
          },
        )
      } else {
        if (next.value.method != null && isRequestID(id)) {
          // Send an error response if incoming message is a request
          transport.write({
            jsonrpc: '2.0',
            id,
            error: { code: INVALID_REQUEST, message: 'Invalid request' },
          })
        } else {
          // TODO: call optional error handler
        }
      }

      handleNext()
    }

    handleNext()
  }

  async handleMessage(
    message: ClientMessage,
    inflight: Record<string, AbortController>,
  ): Promise<ServerResult | null> {
    if (message.id == null) {
      const notification = message as ClientNotification
      switch (notification.method) {
        case 'notifications/cancelled': {
          const controller = inflight[notification.params.requestId]
          if (controller != null) {
            controller.abort()
            delete inflight[notification.params.requestId]
          }
          break
        }
      }
      return null
    }

    if (message.method == null) {
      // TODO: handle response or error
      return null
    }

    const request = message as ClientRequest
    const controller = new AbortController()
    inflight[request.id] = controller
    return await this.handleRequest(request, controller.signal)
  }

  async handleRequest(request: ClientRequest, signal: AbortSignal): Promise<ServerResult> {
    switch (request.method) {
      case 'initialize':
        return {
          capabilities: {}, // TODO
          protocolVersion: LATEST_PROTOCOL_VERSION,
          serverInfo: this.#serverInfo,
        } satisfies InitializeResult
      case 'tools/call':
        return await this.callTool(request, signal)
      case 'tools/list':
        return { tools: this.#toolsList }
      default:
        throw new RPCError(METHOD_NOT_FOUND, `Unsupported method: ${request.method}`)
    }
  }

  callTool(request: CallToolRequest, signal: AbortSignal): Promise<CallToolResult> {
    const handler = this.#toolHandlers[request.params.name] as ToolHandler<Schema>
    if (handler == null) {
      return Promise.reject(new Error(`Tool ${request.params.name} not found`))
    }

    const context = { input: request.params.arguments, signal } as ToolHandlerContext<Schema>
    return Promise.resolve().then(() => handler(context))
  }
}
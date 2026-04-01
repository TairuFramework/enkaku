import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { createHandlers } from './handlers.js'
import { HubClientRegistry } from './registry.js'

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store: HubStore
  accessControl?: boolean
  identity?: Identity
}

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const server = serve<HubProtocol>({
    handlers: createHandlers({ registry, store: params.store }),
    transport: params.transport,
    accessControl: params.accessControl ?? false,
    identity: params.identity,
  })
  return { registry, server }
}

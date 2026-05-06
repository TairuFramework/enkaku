import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { AccessRules, ServeParams, Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { createHandlers } from './handlers.js'
import { HubClientRegistry } from './registry.js'

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store: HubStore
  accessRules?: AccessRules
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
    identity: params.identity,
    ...(params.accessRules != null ? { accessRules: params.accessRules } : {}),
  } as ServeParams<HubProtocol>)
  return { registry, server }
}

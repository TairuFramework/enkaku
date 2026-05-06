import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { AccessRules, Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { createHandlers } from './handlers.js'
import { HubClientRegistry } from './registry.js'

type BaseCreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store: HubStore
}

export type CreateHubParams =
  | (BaseCreateHubParams & { identity?: undefined; accessRules?: never })
  | (BaseCreateHubParams & { identity: Identity; accessRules?: AccessRules })

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const handlers = createHandlers({ registry, store: params.store })
  const server =
    params.identity != null
      ? serve<HubProtocol>({
          handlers,
          transport: params.transport,
          identity: params.identity,
          accessRules: params.accessRules,
        })
      : serve<HubProtocol>({
          handlers,
          transport: params.transport,
        })
  return { registry, server }
}

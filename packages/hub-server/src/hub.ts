import { type HubProtocol, type HubStore, hubProtocol } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { AccessRules, Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { createHandlers, type KeyPackageFetchLimits } from './handlers.js'
import { HubClientRegistry } from './registry.js'

/**
 * Default access rules: any authenticated DID may call hub procedures.
 * The hub is a blind relay — per-procedure authorization (group membership,
 * capability validation) happens in the handlers.
 */
export const DEFAULT_HUB_ACCESS_RULES: AccessRules = {
  'hub/*': { allow: true },
}

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store: HubStore
  /**
   * Hub server identity. Required: all hub procedures derive the client DID
   * from the verified `iss` of signed messages.
   */
  identity: Identity
  /** Access rules enforced by the server. Defaults to {@link DEFAULT_HUB_ACCESS_RULES}. */
  accessRules?: AccessRules
  /** Quotas applied to hub/keypackage/fetch. Merged over {@link DEFAULT_KEYPACKAGE_FETCH_LIMITS}. */
  keyPackageFetchLimits?: Partial<KeyPackageFetchLimits>
}

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const handlers = createHandlers({
    registry,
    store: params.store,
    keyPackageFetchLimits: params.keyPackageFetchLimits,
  })
  const server = serve<HubProtocol>({
    handlers,
    protocol: hubProtocol,
    transport: params.transport,
    identity: params.identity,
    accessRules: params.accessRules ?? DEFAULT_HUB_ACCESS_RULES,
  })
  return { registry, server }
}

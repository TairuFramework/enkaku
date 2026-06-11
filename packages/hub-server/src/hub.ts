import { type HubProtocol, type HubStore, hubProtocol } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { AccessRules, ResourceLimits, Server } from '@enkaku/server'
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

export type HubPurgeOptions = {
  /** Interval between purge runs in milliseconds. Default: 3600000 (1 hour) */
  interval?: number
  /** Age in seconds after which unacked stored messages are purged. Default: 604800 (7 days) */
  olderThan?: number
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
  /** Scheduled purge of expired stored messages. Set to `false` to disable. */
  purge?: HubPurgeOptions | false
  /**
   * Server resource limits. `hub/receive` is always added to
   * `longLivedProcedures` so open mailbox channels are exempt from
   * `controllerTimeoutMs` and from the `maxConcurrentHandlers` cap.
   */
  limits?: Partial<ResourceLimits>
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
  const limits: Partial<ResourceLimits> = {
    ...params.limits,
    longLivedProcedures: [
      ...new Set([...(params.limits?.longLivedProcedures ?? []), 'hub/receive']),
    ],
  }
  const server = serve<HubProtocol>({
    handlers,
    protocol: hubProtocol,
    transport: params.transport,
    identity: params.identity,
    accessRules: params.accessRules ?? DEFAULT_HUB_ACCESS_RULES,
    limits,
  })
  if (params.purge !== false) {
    const interval = params.purge?.interval ?? 3_600_000
    const olderThan = params.purge?.olderThan ?? 604_800
    const purgeTimer = setInterval(() => {
      params.store.purge({ olderThan }).catch(() => {
        // Purge failures are non-fatal; retried on the next interval
      })
    }, interval)
    server.disposed.then(() => clearInterval(purgeTimer))
  }
  return { registry, server }
}

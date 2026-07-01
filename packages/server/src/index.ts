/**
 * Server logic for Enkaku RPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/server
 * ```
 *
 * ## Replay protection
 *
 * When the server requires authentication (the default -- see `requireAuth`), every
 * signed `event`, `send`, and `abort` message is checked for replay before it reaches
 * the access-control or handler logic. A message that reuses the dedup key of a
 * previously-seen message (same issuer + `jti`, or issuer + signature when `jti` is
 * absent) is rejected with a `EK09` (`REPLAY_DETECTED`) error and a `handlerError`
 * event in the `auth` category. Protection is on by default whenever authentication
 * is required, and it is server-wide: the same in-memory cache is shared across all
 * transports/connections attached to a given `Server` instance.
 *
 * Configure it with the `replay?: ReplayOptions` server option:
 *
 * - `enabled?: boolean` -- set to `false` to disable replay protection entirely
 *   (defaults to `true` whenever `requireAuth` is `true`).
 * - `cache?: ReplayCache` -- plug in a persistent or shared backend (e.g. Redis)
 *   instead of the built-in `MemoryReplayCache`, useful when running multiple server
 *   instances behind a load balancer. Must implement `checkAndRecord(key, expiresAt)`.
 *   Note: a custom cache is responsible for its own clock/expiry; the server's `now`
 *   (used for staleness) is not injected into it, so keep the two clocks consistent.
 * - `maxAge?: number` -- fallback dedup/staleness window, in **milliseconds**, used
 *   for messages that carry no `exp` claim. Defaults to 60_000 (60s).
 * - `rejectStale?: boolean` -- when `true` (the default), messages that are already
 *   expired (`exp` in the past) or older than `maxAge` (when no `exp` is present) are
 *   rejected as stale before the replay cache is even consulted.
 * - `maxEntries?: number` -- caps the size of the default `MemoryReplayCache` (evicts
 *   expired entries first, then oldest-inserted). Ignored when a custom `cache` is
 *   supplied. This bounds memory at the cost of a replay window: a flood of distinct
 *   fresh keys can evict an older not-yet-expired entry, so size it above your expected
 *   in-flight message volume, or supply a persistent `cache` if that trade-off is
 *   unacceptable.
 *
 * **Units note:** token claims `exp` and `iat` are epoch **seconds** (per the JWT/token
 * convention), while `maxAge` (and the `expiresAt` passed to `ReplayCache.checkAndRecord`)
 * are epoch/duration **milliseconds**. The seconds-to-milliseconds conversion happens
 * once, internally, when the message is checked.
 *
 * @module server
 */

export type {
  AccessRule,
  AccessRules,
  AllowContext,
  AllowPredicate,
  EncryptionPolicy,
} from './access-control.js'
export { resolveEncryptionPolicy } from './access-control.js'
export {
  HandlerError,
  type HandlerErrorParams,
} from './error.js'
export {
  createResourceLimiter,
  DEFAULT_RESOURCE_LIMITS,
  type ResourceLimiter,
  type ResourceLimits,
} from './limits.js'
export {
  MemoryReplayCache,
  type ReplayCache,
  type ReplayOptions,
} from './replay.js'
export {
  type ServeParams,
  Server,
  type ServerAccessOptions,
  type ServerBaseParams,
  type ServerParams,
  serve,
} from './server.js'
export type {
  ChannelHandler,
  ChannelHandlerContext,
  EventHandler,
  EventHandlerContext,
  HandlerErrorCategory,
  HandlerErrorMessageType,
  HandlerReturn,
  ProcedureHandlers,
  RequestHandler,
  RequestHandlerContext,
  ServerEmitter,
  ServerEvents,
  StreamHandler,
  StreamHandlerContext,
} from './types.js'

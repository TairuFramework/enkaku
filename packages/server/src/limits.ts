export type ResourceLimits = {
  /** Maximum number of concurrent controllers (in-flight requests). Default: 10000 */
  maxControllers: number
  /** Maximum number of concurrent handler executions. Default: 100 */
  maxConcurrentHandlers: number
  /** Controller timeout in milliseconds. Default: 300000 (5 min) */
  controllerTimeoutMs: number
  /** Cleanup timeout in milliseconds when disposing. Default: 30000 (30 sec) */
  cleanupTimeoutMs: number
  /** Maximum size in bytes for any individual message payload. Default: 10485760 (10 MB) */
  maxMessageSize: number
  /**
   * Procedures treated as long-lived: exempt from controllerTimeoutMs and
   * counted separately from maxConcurrentHandlers (bounded by maxControllers).
   * Default: []
   */
  longLivedProcedures: Array<string>
}

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxControllers: 10000,
  maxConcurrentHandlers: 100,
  controllerTimeoutMs: 300000,
  cleanupTimeoutMs: 30000,
  maxMessageSize: 10485760,
  longLivedProcedures: [],
}

export type ResourceLimiter = {
  limits: ResourceLimits
  controllerCount: number
  activeHandlers: number
  activeLongLivedHandlers: number
  canAddController: () => boolean
  addController: (rid: string, longLived?: boolean) => void
  removeController: (rid: string) => void
  getExpiredControllers: () => Array<string>
  acquireHandler: (longLived?: boolean) => boolean
  releaseHandler: (longLived?: boolean) => void
}

type ControllerRecord = {
  timestamp: number
  longLived: boolean
}

export function createResourceLimiter(options?: Partial<ResourceLimits>): ResourceLimiter {
  const limits: ResourceLimits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...options,
  }

  const controllers = new Map<string, ControllerRecord>()
  let handlerCount = 0
  let longLivedHandlerCount = 0

  return {
    limits,
    get controllerCount() {
      return controllers.size
    },
    get activeHandlers() {
      return handlerCount
    },
    get activeLongLivedHandlers() {
      return longLivedHandlerCount
    },
    canAddController() {
      return controllers.size < limits.maxControllers
    },
    addController(rid: string, longLived = false) {
      controllers.set(rid, { timestamp: Date.now(), longLived })
    },
    removeController(rid: string) {
      controllers.delete(rid)
    },
    getExpiredControllers() {
      const now = Date.now()
      const expired: Array<string> = []
      for (const [rid, record] of controllers) {
        if (!record.longLived && now - record.timestamp > limits.controllerTimeoutMs) {
          expired.push(rid)
        }
      }
      return expired
    },
    acquireHandler(longLived = false) {
      if (longLived) {
        // Long-lived handlers (e.g. persistent channels) bypass the
        // concurrency cap; they remain bounded by maxControllers.
        longLivedHandlerCount++
        return true
      }
      if (handlerCount >= limits.maxConcurrentHandlers) {
        return false
      }
      handlerCount++
      return true
    },
    releaseHandler(longLived = false) {
      if (longLived) {
        if (longLivedHandlerCount > 0) {
          longLivedHandlerCount--
        }
        return
      }
      if (handlerCount > 0) {
        handlerCount--
      }
    },
  }
}

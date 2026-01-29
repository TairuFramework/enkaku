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
}

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxControllers: 10000,
  maxConcurrentHandlers: 100,
  controllerTimeoutMs: 300000,
  cleanupTimeoutMs: 30000,
  maxMessageSize: 10485760,
}

export type ResourceLimiter = {
  limits: ResourceLimits
  controllerCount: number
  activeHandlers: number
  canAddController: () => boolean
  addController: (rid: string) => void
  removeController: (rid: string) => void
  getExpiredControllers: () => Array<string>
  acquireHandler: () => boolean
  releaseHandler: () => void
}

export function createResourceLimiter(options?: Partial<ResourceLimits>): ResourceLimiter {
  const limits: ResourceLimits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...options,
  }

  const controllers = new Map<string, number>() // rid -> timestamp
  let handlerCount = 0

  return {
    limits,
    get controllerCount() {
      return controllers.size
    },
    get activeHandlers() {
      return handlerCount
    },
    canAddController() {
      return controllers.size < limits.maxControllers
    },
    addController(rid: string) {
      controllers.set(rid, Date.now())
    },
    removeController(rid: string) {
      controllers.delete(rid)
    },
    getExpiredControllers() {
      const now = Date.now()
      const expired: Array<string> = []
      for (const [rid, timestamp] of controllers) {
        if (now - timestamp > limits.controllerTimeoutMs) {
          expired.push(rid)
        }
      }
      return expired
    },
    acquireHandler() {
      if (handlerCount >= limits.maxConcurrentHandlers) {
        return false
      }
      handlerCount++
      return true
    },
    releaseHandler() {
      if (handlerCount > 0) {
        handlerCount--
      }
    },
  }
}

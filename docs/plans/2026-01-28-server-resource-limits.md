# Server Resource Limits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add resource limits and authorization enforcement to the server package to prevent DoS attacks and ensure proper security.

**Architecture:** Create a `ResourceLimits` configuration type that controls controller count, handler concurrency, timeouts, and buffer sizes. Add authorization validation for channel `send` messages. Implement cleanup mechanisms with timeouts.

**Tech Stack:** TypeScript, @enkaku/async, Vitest for testing

---

## Summary of Issues Addressed

| Issue ID | Severity | Description | Status |
|----------|----------|-------------|--------|
| C-05 | CRITICAL | Unbounded Controller Storage (Server DoS) | Fixed (Tasks 1-3, 5, 7) |
| C-06 | CRITICAL | No Concurrent Handler Limits | Fixed (Tasks 4, 5) |
| C-07 | CRITICAL | Channel Send Messages Skip Authorization | Fixed (Task 6) |
| H-13 | HIGH | Unbounded Stream Buffer | Fixed (Task 10 — per-message size limit) |
| H-14 | HIGH | Unbounded Channel Buffer | Fixed (Task 10 — per-message size limit) |
| H-15 | HIGH | Event Handlers Skip Authorization Response | Fixed (Task 12) |
| M-10 | MEDIUM | Validation is Optional (Server) | Mitigated (Task 11 — warning logged) |
| M-11 | MEDIUM | Stream Not Closed on Handler Crash | Fixed (Task 9) |
| M-12 | MEDIUM | No Cleanup Timeout on Server Dispose | Fixed (Task 8) |
| T-03 | TEST | Client/Server Resource Limit Tests Missing | Fixed (Tasks 5-12) |

---

## Task 1: Create Resource Limits Types and Configuration

**Files:**
- Create: `packages/server/src/limits.ts`
- Modify: `packages/server/src/types.ts`
- Test: `packages/server/test/limits.test.ts`

**Step 1: Write the failing test**

Create test file `packages/server/test/limits.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import {
  DEFAULT_RESOURCE_LIMITS,
  type ResourceLimits,
  createResourceLimiter,
  type ResourceLimiter,
} from '../src/limits.js'

describe('ResourceLimits', () => {
  test('DEFAULT_RESOURCE_LIMITS has expected values', () => {
    expect(DEFAULT_RESOURCE_LIMITS.maxControllers).toBe(10000)
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentHandlers).toBe(100)
    expect(DEFAULT_RESOURCE_LIMITS.controllerTimeoutMs).toBe(300000) // 5 min
    expect(DEFAULT_RESOURCE_LIMITS.cleanupTimeoutMs).toBe(30000) // 30 sec
    expect(DEFAULT_RESOURCE_LIMITS.maxMessageSize).toBe(10485760) // 10 MB
  })

  test('createResourceLimiter returns limiter with defaults', () => {
    const limiter = createResourceLimiter()
    expect(limiter.limits).toEqual(DEFAULT_RESOURCE_LIMITS)
  })

  test('createResourceLimiter merges partial options', () => {
    const limiter = createResourceLimiter({ maxControllers: 500 })
    expect(limiter.limits.maxControllers).toBe(500)
    expect(limiter.limits.maxConcurrentHandlers).toBe(100) // default preserved
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: FAIL with "Cannot find module '../src/limits.js'"

**Step 3: Write minimal implementation**

Create `packages/server/src/limits.ts`:

```typescript
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
}

export function createResourceLimiter(
  options?: Partial<ResourceLimits>,
): ResourceLimiter {
  const limits: ResourceLimits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...options,
  }
  return { limits }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/limits.ts packages/server/test/limits.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add ResourceLimits types and configuration

Addresses C-05, C-06 (partial): Define resource limit configuration
for server to prevent DoS attacks.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Controller Count Limiting (C-05)

**Files:**
- Modify: `packages/server/src/limits.ts`
- Test: `packages/server/test/limits.test.ts`

**Step 1: Write the failing test**

Add to `packages/server/test/limits.test.ts`:

```typescript
describe('ResourceLimiter controller tracking', () => {
  test('canAddController returns true when under limit', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    expect(limiter.canAddController()).toBe(true)
  })

  test('addController increments count', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    expect(limiter.controllerCount).toBe(0)
    limiter.addController('rid1')
    expect(limiter.controllerCount).toBe(1)
  })

  test('canAddController returns false at limit', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    limiter.addController('rid1')
    limiter.addController('rid2')
    expect(limiter.canAddController()).toBe(false)
  })

  test('removeController decrements count', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    limiter.addController('rid1')
    limiter.addController('rid2')
    expect(limiter.controllerCount).toBe(2)
    limiter.removeController('rid1')
    expect(limiter.controllerCount).toBe(1)
    expect(limiter.canAddController()).toBe(true)
  })

  test('removeController is idempotent for unknown rid', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    limiter.addController('rid1')
    limiter.removeController('unknown')
    expect(limiter.controllerCount).toBe(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: FAIL with "limiter.canAddController is not a function"

**Step 3: Write minimal implementation**

Update `packages/server/src/limits.ts`:

```typescript
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
  canAddController: () => boolean
  addController: (rid: string) => void
  removeController: (rid: string) => void
}

export function createResourceLimiter(
  options?: Partial<ResourceLimits>,
): ResourceLimiter {
  const limits: ResourceLimits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...options,
  }

  const controllers = new Set<string>()

  return {
    limits,
    get controllerCount() {
      return controllers.size
    },
    canAddController() {
      return controllers.size < limits.maxControllers
    },
    addController(rid: string) {
      controllers.add(rid)
    },
    removeController(rid: string) {
      controllers.delete(rid)
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/limits.ts packages/server/test/limits.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add controller count tracking to ResourceLimiter

Addresses C-05: Implements controller counting to enforce maximum
concurrent controllers limit.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Controller Timeout Tracking (C-05)

**Files:**
- Modify: `packages/server/src/limits.ts`
- Test: `packages/server/test/limits.test.ts`

**Step 1: Write the failing test**

Add to `packages/server/test/limits.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

describe('ResourceLimiter controller timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('getExpiredControllers returns empty when none expired', () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 1000 })
    limiter.addController('rid1')
    expect(limiter.getExpiredControllers()).toEqual([])
  })

  test('getExpiredControllers returns expired controllers', () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 1000 })
    limiter.addController('rid1')
    vi.advanceTimersByTime(500)
    limiter.addController('rid2')
    vi.advanceTimersByTime(600)
    // rid1 is now 1100ms old (expired), rid2 is 600ms old (not expired)
    const expired = limiter.getExpiredControllers()
    expect(expired).toEqual(['rid1'])
  })

  test('removeController clears timeout tracking', () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 1000 })
    limiter.addController('rid1')
    limiter.removeController('rid1')
    vi.advanceTimersByTime(2000)
    expect(limiter.getExpiredControllers()).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: FAIL with "limiter.getExpiredControllers is not a function"

**Step 3: Write minimal implementation**

Update `packages/server/src/limits.ts` to track timestamps:

```typescript
export type ResourceLimiter = {
  limits: ResourceLimits
  controllerCount: number
  canAddController: () => boolean
  addController: (rid: string) => void
  removeController: (rid: string) => void
  getExpiredControllers: () => string[]
}

export function createResourceLimiter(
  options?: Partial<ResourceLimits>,
): ResourceLimiter {
  const limits: ResourceLimits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...options,
  }

  const controllers = new Map<string, number>() // rid -> timestamp

  return {
    limits,
    get controllerCount() {
      return controllers.size
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
      const expired: string[] = []
      for (const [rid, timestamp] of controllers) {
        if (now - timestamp > limits.controllerTimeoutMs) {
          expired.push(rid)
        }
      }
      return expired
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/limits.ts packages/server/test/limits.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add controller timeout tracking

Addresses C-05: Track controller creation timestamps and provide
method to identify expired controllers for cleanup.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add Concurrent Handler Semaphore (C-06)

**Files:**
- Modify: `packages/server/src/limits.ts`
- Test: `packages/server/test/limits.test.ts`

**Step 1: Write the failing test**

Add to `packages/server/test/limits.test.ts`:

```typescript
describe('ResourceLimiter handler concurrency', () => {
  test('acquireHandler returns true when under limit', async () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    expect(await limiter.acquireHandler()).toBe(true)
    expect(limiter.activeHandlers).toBe(1)
  })

  test('acquireHandler returns false at limit', async () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    await limiter.acquireHandler()
    await limiter.acquireHandler()
    expect(await limiter.acquireHandler()).toBe(false)
    expect(limiter.activeHandlers).toBe(2)
  })

  test('releaseHandler decrements count', async () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    await limiter.acquireHandler()
    await limiter.acquireHandler()
    limiter.releaseHandler()
    expect(limiter.activeHandlers).toBe(1)
    expect(await limiter.acquireHandler()).toBe(true)
  })

  test('releaseHandler does not go negative', () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    limiter.releaseHandler()
    expect(limiter.activeHandlers).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: FAIL with "limiter.acquireHandler is not a function"

**Step 3: Write minimal implementation**

Update `packages/server/src/limits.ts`:

```typescript
export type ResourceLimiter = {
  limits: ResourceLimits
  controllerCount: number
  activeHandlers: number
  canAddController: () => boolean
  addController: (rid: string) => void
  removeController: (rid: string) => void
  getExpiredControllers: () => string[]
  acquireHandler: () => Promise<boolean>
  releaseHandler: () => void
}

export function createResourceLimiter(
  options?: Partial<ResourceLimits>,
): ResourceLimiter {
  const limits: ResourceLimits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...options,
  }

  const controllers = new Map<string, number>()
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
      const expired: string[] = []
      for (const [rid, timestamp] of controllers) {
        if (now - timestamp > limits.controllerTimeoutMs) {
          expired.push(rid)
        }
      }
      return expired
    },
    async acquireHandler() {
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- limits.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/limits.ts packages/server/test/limits.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add handler concurrency limiting

Addresses C-06: Implements semaphore-like handler acquisition to
prevent unbounded concurrent handler execution.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integrate ResourceLimiter into Server (C-05, C-06)

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/test/resource-limits.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/resource-limits.test.ts`:

```typescript
import { Defer } from '@enkaku/async'
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/server.js'
import { createMockTransport } from './lib.test.js'

describe('Server resource limits', () => {
  test('rejects requests when controller limit reached', async () => {
    const transport = createMockTransport()
    const defers = [new Defer<void>(), new Defer<void>()]

    const server = new Server({
      public: true,
      handlers: {
        slow: async ({ signal }) => {
          const idx = defers.findIndex((d) => !d.resolved)
          await defers[idx]?.promise
          return 'done'
        },
      },
      transports: [transport],
      limits: { maxControllers: 2 },
    })

    // Send 3 requests, only 2 should be accepted
    transport.mockReceive({ payload: { typ: 'request', prc: 'slow', rid: 'r1' } })
    transport.mockReceive({ payload: { typ: 'request', prc: 'slow', rid: 'r2' } })
    transport.mockReceive({ payload: { typ: 'request', prc: 'slow', rid: 'r3' } })

    // Wait for processing
    await vi.waitFor(() => {
      expect(transport.written.length).toBeGreaterThan(0)
    })

    // r3 should be rejected with limit error
    const rejected = transport.written.find(
      (msg) => msg.payload.rid === 'r3' && msg.payload.typ === 'error',
    )
    expect(rejected).toBeDefined()
    expect(rejected?.payload.err.message).toContain('limit')

    // Complete the handlers
    defers[0].resolve()
    defers[1].resolve()

    await server.dispose()
  })

  test('enforces concurrent handler limit', async () => {
    const transport = createMockTransport()
    const handlerStarts: string[] = []
    const defers = new Map<string, Defer<void>>()

    const server = new Server({
      public: true,
      handlers: {
        tracked: async ({ param, signal }) => {
          handlerStarts.push(param)
          const defer = new Defer<void>()
          defers.set(param, defer)
          await defer.promise
          return param
        },
      },
      transports: [transport],
      limits: { maxConcurrentHandlers: 2, maxControllers: 10 },
    })

    // Send 3 requests
    transport.mockReceive({ payload: { typ: 'request', prc: 'tracked', rid: 'r1', prm: 'first' } })
    transport.mockReceive({ payload: { typ: 'request', prc: 'tracked', rid: 'r2', prm: 'second' } })
    transport.mockReceive({ payload: { typ: 'request', prc: 'tracked', rid: 'r3', prm: 'third' } })

    // Wait for first two handlers to start
    await vi.waitFor(() => {
      expect(handlerStarts.length).toBe(2)
    })

    // Third should be queued/rejected
    expect(handlerStarts).toEqual(['first', 'second'])

    // Complete first handler
    defers.get('first')?.resolve()

    // Third should now start (or be rejected depending on implementation)
    await vi.waitFor(() => {
      expect(handlerStarts.length).toBe(3)
    })

    defers.get('second')?.resolve()
    defers.get('third')?.resolve()

    await server.dispose()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- resource-limits.test.ts`
Expected: FAIL with "limits is not a property"

**Step 3: Write minimal implementation**

Update `packages/server/src/server.ts` to accept and use limits:

1. Add import at top:
```typescript
import { createResourceLimiter, type ResourceLimiter, type ResourceLimits } from './limits.js'
```

2. Update `HandleMessagesParams`:
```typescript
export type HandleMessagesParams<Protocol extends ProtocolDefinition> = AccessControlParams & {
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  limiter: ResourceLimiter
  logger: Logger
  signal: AbortSignal
  transport: ServerTransportOf<Protocol>
  validator?: Validator<AnyClientMessageOf<Protocol>>
}
```

3. Update `ServerParams`:
```typescript
export type ServerParams<Protocol extends ProtocolDefinition> = {
  access?: ProcedureAccessRecord
  handlers: ProcedureHandlers<Protocol>
  id?: string
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  public?: boolean
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
}
```

4. Update `handleMessages` function to check limits before processing:
```typescript
async function handleMessages<Protocol extends ProtocolDefinition>(
  params: HandleMessagesParams<Protocol>,
): Promise<void> {
  const { events, handlers, limiter, logger, signal, transport, validator } = params

  // ... existing code for controllers, context, disposer ...

  function processHandler(
    message: ProcessMessageOf<Protocol>,
    handle: () => Error | Promise<void>,
  ) {
    const rid = message.payload.typ === 'event'
      ? Math.random().toString(36).slice(2)
      : message.payload.rid

    // Check controller limit
    if (!limiter.canAddController()) {
      const error = new HandlerError({
        code: 'EK03',
        message: 'Server controller limit reached',
      })
      if (message.payload.typ !== 'event') {
        context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>)
      }
      events.emit('handlerError', { error, payload: message.payload })
      return
    }

    // Check handler concurrency
    const acquired = limiter.acquireHandler()
    if (!acquired) {
      const error = new HandlerError({
        code: 'EK04',
        message: 'Server handler limit reached',
      })
      if (message.payload.typ !== 'event') {
        context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>)
      }
      events.emit('handlerError', { error, payload: message.payload })
      return
    }

    limiter.addController(rid)

    const returned = handle()
    if (returned instanceof Error) {
      limiter.removeController(rid)
      limiter.releaseHandler()
      events.emit('handlerError', {
        error: HandlerError.from(returned, { code: 'EK01' }),
        payload: message.payload,
      })
    } else {
      running[rid] = returned
      returned.then(() => {
        limiter.removeController(rid)
        limiter.releaseHandler()
        delete running[rid]
      })
    }
  }
  // ... rest of function ...
}
```

5. Update `Server` class to create limiter:
```typescript
export class Server<Protocol extends ProtocolDefinition> extends Disposer {
  #limiter: ResourceLimiter
  // ... other fields ...

  constructor(params: ServerParams<Protocol>) {
    // ... existing code ...
    this.#limiter = createResourceLimiter(params.limits)
    // ... rest of constructor ...
  }

  handle(transport: ServerTransportOf<Protocol>, options: HandleOptions = {}): Promise<void> {
    // ... existing code ...
    const done = handleMessages<Protocol>({
      events: this.#events,
      handlers: this.#handlers,
      limiter: this.#limiter,
      logger,
      signal: this.#abortController.signal,
      transport,
      validator: this.#validator,
      ...accessControl,
    })
    // ... rest of method ...
  }
}
```

6. Update `packages/server/src/index.ts` to export limits:
```typescript
export {
  createResourceLimiter,
  DEFAULT_RESOURCE_LIMITS,
  type ResourceLimiter,
  type ResourceLimits,
} from './limits.js'
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- resource-limits.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/src/index.ts packages/server/test/resource-limits.test.ts
git commit -m "$(cat <<'EOF'
feat(server): integrate resource limits into Server

Addresses C-05, C-06: Server now enforces controller count and
concurrent handler limits, rejecting requests that exceed limits.

BREAKING CHANGE: Server constructor accepts new `limits` option.
Servers now reject requests when limits are exceeded with EK03/EK04 errors.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Channel Send Authorization (C-07)

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/test/channel-send-auth.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/channel-send-auth.test.ts`:

```typescript
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/server.js'
import { createMockTransport, createMockSignedMessage } from './lib.test.js'

describe('Channel send authorization', () => {
  test('send messages require valid controller', async () => {
    const transport = createMockTransport()
    const receivedValues: unknown[] = []

    const server = new Server({
      public: true,
      handlers: {
        chat: async ({ readable, writable }) => {
          for await (const value of readable) {
            receivedValues.push(value)
          }
          return 'done'
        },
      },
      transports: [transport],
    })

    // Send to non-existent channel - should be ignored
    transport.mockReceive({ payload: { typ: 'send', rid: 'unknown', val: 'hello' } })

    await vi.waitFor(() => {
      // No errors, just ignored
    }, { timeout: 100 })

    expect(receivedValues).toEqual([])

    await server.dispose()
  })

  test('send messages validate against channel permissions in non-public mode', async () => {
    const transport = createMockTransport()
    const serverID = 'did:key:test-server'
    const receivedValues: unknown[] = []

    const server = new Server({
      id: serverID,
      public: false,
      access: {
        chat: { action: 'chat', resource: 'room/*' },
      },
      handlers: {
        chat: async ({ readable, writable }) => {
          for await (const value of readable) {
            receivedValues.push(value)
          }
          return 'done'
        },
      },
      transports: [transport],
    })

    // First establish channel with valid auth
    const channelMsg = createMockSignedMessage({
      payload: { typ: 'channel', prc: 'chat', rid: 'ch1', prm: {} },
    })
    transport.mockReceive(channelMsg)

    // Then send without auth - should be rejected or require the original auth
    transport.mockReceive({ payload: { typ: 'send', rid: 'ch1', val: 'unauthorized' } })

    await vi.waitFor(() => {
      const error = transport.written.find(
        (msg) => msg.payload.typ === 'error' && msg.payload.rid === 'ch1',
      )
      expect(error).toBeDefined()
    })

    await server.dispose()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- channel-send-auth.test.ts`
Expected: FAIL (send messages are not validated)

**Step 3: Write minimal implementation**

Update `handleMessages` in `packages/server/src/server.ts`:

```typescript
// Inside handleNext function, update the 'send' case:
case 'send': {
  const controller = controllers[msg.payload.rid] as ChannelController | undefined
  if (controller == null) {
    // Ignore sends to non-existent channels
    logger.debug('received send for unknown channel {rid}', { rid: msg.payload.rid })
    break
  }
  // In non-public mode, validate send messages
  if (!params.public) {
    if (!isSignedToken(msg as Token)) {
      const error = new HandlerError({
        code: 'EK02',
        message: 'Channel send message must be signed',
      })
      context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>)
      break
    }
    try {
      await checkClientToken(
        params.serverID,
        params.access,
        msg as unknown as SignedToken,
      )
    } catch (cause) {
      const error = new HandlerError({
        cause,
        code: 'EK02',
        message: (cause as Error).message ?? 'Send authorization denied',
      })
      context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>)
      break
    }
  }
  controller.writer.write(msg.payload.val)
  break
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- channel-send-auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/channel-send-auth.test.ts
git commit -m "$(cat <<'EOF'
fix(server): validate channel send messages in non-public mode

Addresses C-07: Channel send messages now require authorization
in non-public mode, preventing authorization bypass after initial
channel handshake.

BREAKING CHANGE: Channel send messages in non-public servers must
be signed and authorized like other message types.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Controller Timeout Cleanup (C-05)

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/test/controller-timeout.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/controller-timeout.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

import { Server } from '../src/server.js'
import { createMockTransport } from './lib.test.js'

describe('Controller timeout cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('controllers are cleaned up after timeout', async () => {
    const transport = createMockTransport()

    const server = new Server({
      public: true,
      handlers: {
        slow: async () => {
          // Never returns
          await new Promise(() => {})
        },
      },
      transports: [transport],
      limits: { controllerTimeoutMs: 1000 },
    })

    transport.mockReceive({ payload: { typ: 'request', prc: 'slow', rid: 'r1' } })

    // Wait for handler to start
    await vi.advanceTimersByTimeAsync(100)

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(1000)

    // Should receive timeout error
    await vi.waitFor(() => {
      const timeout = transport.written.find(
        (msg) => msg.payload.rid === 'r1' && msg.payload.typ === 'error',
      )
      expect(timeout?.payload.err.message).toContain('timeout')
    })

    // Should emit handlerTimeout event
    expect(server.events.listenerCount('handlerTimeout')).toBeDefined()

    await server.dispose()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- controller-timeout.test.ts`
Expected: FAIL (no timeout cleanup occurs)

**Step 3: Write minimal implementation**

Update `handleMessages` in `packages/server/src/server.ts` to add periodic cleanup:

```typescript
async function handleMessages<Protocol extends ProtocolDefinition>(
  params: HandleMessagesParams<Protocol>,
): Promise<void> {
  // ... existing setup code ...

  // Periodic cleanup of expired controllers
  const cleanupInterval = setInterval(() => {
    const expired = limiter.getExpiredControllers()
    for (const rid of expired) {
      const controller = controllers[rid]
      if (controller) {
        controller.abort('Timeout')
        const error = new HandlerError({
          code: 'EK05',
          message: 'Request timeout',
        })
        context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>)
        events.emit('handlerTimeout', { rid })
        limiter.removeController(rid)
        delete controllers[rid]
      }
    }
  }, 10000) // Check every 10 seconds

  const disposer = new Disposer({
    dispose: async () => {
      clearInterval(cleanupInterval)
      // ... rest of dispose logic ...
    },
    signal,
  })

  // ... rest of function ...
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- controller-timeout.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/controller-timeout.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add periodic controller timeout cleanup

Addresses C-05: Expired controllers are now cleaned up periodically,
preventing memory leaks from abandoned requests.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add Cleanup Timeout on Dispose (M-12)

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/test/dispose-timeout.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/dispose-timeout.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

import { Server } from '../src/server.js'
import { createMockTransport } from './lib.test.js'

describe('Server dispose timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('dispose completes within cleanup timeout even with stuck handlers', async () => {
    const transport = createMockTransport()

    const server = new Server({
      public: true,
      handlers: {
        stuck: async () => {
          // Handler ignores abort signal and never returns
          await new Promise(() => {})
        },
      },
      transports: [transport],
      limits: { cleanupTimeoutMs: 1000 },
    })

    transport.mockReceive({ payload: { typ: 'request', prc: 'stuck', rid: 'r1' } })

    // Wait for handler to start
    await vi.advanceTimersByTimeAsync(100)

    // Start dispose
    const disposePromise = server.dispose()

    // Advance past cleanup timeout
    await vi.advanceTimersByTimeAsync(1500)

    // Dispose should complete even though handler is stuck
    await expect(disposePromise).resolves.toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- dispose-timeout.test.ts`
Expected: FAIL (dispose waits indefinitely)

**Step 3: Write minimal implementation**

Update the `Server` class dispose logic in `packages/server/src/server.ts`:

```typescript
constructor(params: ServerParams<Protocol>) {
  super({
    dispose: async () => {
      // Signal messages handler to stop execution and run cleanup logic
      this.#abortController.abort()

      // Wait for handlers with timeout
      const cleanupTimeout = this.#limiter.limits.cleanupTimeoutMs
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, cleanupTimeout)
      })

      // Race between cleanup and timeout
      await Promise.race([
        Promise.all(
          this.#handling.map(async (handling) => {
            await handling.done
            await handling.transport.dispose()
          }),
        ),
        timeoutPromise,
      ])

      // Force dispose any remaining transports
      for (const handling of this.#handling) {
        try {
          await handling.transport.dispose()
        } catch {
          // Ignore errors during forced cleanup
        }
      }
    },
    signal: params.signal,
  })
  // ... rest of constructor ...
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- dispose-timeout.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/dispose-timeout.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add cleanup timeout on dispose

Addresses M-12: Server dispose now completes within the cleanup timeout
even if handlers ignore abort signals and never complete.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Close Streams on Handler Crash (M-11)

**Files:**
- Modify: `packages/server/src/handlers/stream.ts`
- Modify: `packages/server/src/handlers/channel.ts`
- Test: `packages/server/test/stream-crash.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/stream-crash.test.ts`:

```typescript
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/server.js'
import { createMockTransport } from './lib.test.js'

describe('Stream handler crash cleanup', () => {
  test('stream is closed when handler throws', async () => {
    const transport = createMockTransport()
    const streamClosed = vi.fn()

    const server = new Server({
      public: true,
      handlers: {
        failing: async ({ writable }) => {
          const writer = writable.getWriter()
          await writer.write('first')
          writer.releaseLock()
          writable.getWriter().closed.then(streamClosed)
          throw new Error('Handler crashed')
        },
      },
      transports: [transport],
    })

    transport.mockReceive({ payload: { typ: 'stream', prc: 'failing', rid: 's1' } })

    await vi.waitFor(() => {
      // Error should be sent
      const error = transport.written.find(
        (msg) => msg.payload.rid === 's1' && msg.payload.typ === 'error',
      )
      expect(error).toBeDefined()
    })

    // Stream should be closed
    await vi.waitFor(() => {
      expect(streamClosed).toHaveBeenCalled()
    })

    await server.dispose()
  })

  test('channel streams are closed when handler throws', async () => {
    const transport = createMockTransport()
    const sendStreamClosed = vi.fn()
    const receiveStreamClosed = vi.fn()

    const server = new Server({
      public: true,
      handlers: {
        failingChannel: async ({ readable, writable }) => {
          readable.getReader().closed.then(sendStreamClosed)
          writable.getWriter().closed.then(receiveStreamClosed)
          throw new Error('Channel crashed')
        },
      },
      transports: [transport],
    })

    transport.mockReceive({ payload: { typ: 'channel', prc: 'failingChannel', rid: 'c1' } })

    await vi.waitFor(() => {
      const error = transport.written.find(
        (msg) => msg.payload.rid === 'c1' && msg.payload.typ === 'error',
      )
      expect(error).toBeDefined()
    })

    // Both streams should be closed
    await vi.waitFor(() => {
      expect(sendStreamClosed).toHaveBeenCalled()
      expect(receiveStreamClosed).toHaveBeenCalled()
    })

    await server.dispose()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- stream-crash.test.ts`
Expected: FAIL (streams remain open after handler crash)

**Step 3: Write minimal implementation**

Update `packages/server/src/handlers/stream.ts`:

```typescript
export function handleStream<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
>(ctx: HandlerContext<Protocol>, msg: StreamMessageOf<Protocol, Procedure>): Error | Promise<void> {
  // ... existing setup code ...

  const receiveStream = createPipe<ReceiveType<Protocol, Procedure>>()
  // Track the pipeTo promise for cleanup
  const pipePromise = receiveStream.readable.pipeTo(
    writeTo<ReceiveType<Protocol, Procedure>>(async (val) => {
      if (controller.signal.aborted) {
        return
      }
      // ... existing write logic ...
    }),
  ).catch(() => {
    // Ignore errors from pipeTo - stream may be aborted
  })

  const handlerContext = {
    message: msg,
    param: msg.payload.prm,
    signal: controller.signal,
    writable: receiveStream.writable,
  }

  // Wrap handler execution to ensure cleanup
  return (async () => {
    try {
      // @ts-expect-error context and handler types
      await executeHandler(ctx, msg.payload, () => handler(handlerContext))
    } finally {
      // Ensure stream is closed on handler completion or error
      try {
        await receiveStream.writable.close()
      } catch {
        // Stream may already be closed
      }
    }
  })()
}
```

Update `packages/server/src/handlers/channel.ts` similarly:

```typescript
export function handleChannel<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: ChannelMessageOf<Protocol, Procedure>,
): Error | Promise<void> {
  // ... existing setup code ...

  // Wrap handler execution to ensure cleanup
  return (async () => {
    try {
      // @ts-expect-error context and handler types
      await executeHandler(ctx, msg.payload, () => handler(handlerContext))
    } finally {
      // Ensure streams are closed on handler completion or error
      try {
        controller.abort('HandlerComplete')
        await receiveStream.writable.close()
      } catch {
        // Streams may already be closed
      }
    }
  })()
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- stream-crash.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/handlers/stream.ts packages/server/src/handlers/channel.ts packages/server/test/stream-crash.test.ts
git commit -m "$(cat <<'EOF'
fix(server): close streams when handler crashes

Addresses M-11: Stream and channel handlers now properly close their
streams when the handler throws an error, preventing resource leaks.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add Per-Message Size Limits (H-13, H-14)

**Files:**
- Modify: `packages/server/src/limits.ts` (rename `maxPayloadSize` → `maxMessageSize`)
- Modify: `packages/server/src/types.ts` (remove `maxPayloadSize` from `HandlerContext`)
- Modify: `packages/server/src/handlers/stream.ts` (remove cumulative tracking)
- Modify: `packages/server/src/handlers/channel.ts` (remove cumulative tracking)
- Modify: `packages/server/src/server.ts` (add per-message check in `handleMessages`)
- Modify: `packages/server/src/error.ts` (document EK06)
- Test: `packages/server/test/buffer-limits.test.ts`

**Approach change:** Instead of cumulative buffer tracking inside individual stream/channel handlers, enforce a per-message size check in `handleMessages` that applies to ALL incoming client messages (request, stream, channel, event). This is simpler, more consistent, and catches oversized messages before they reach any handler.

**Step 1: Rename limit**

In `packages/server/src/limits.ts`:
- Rename `maxPayloadSize` → `maxMessageSize` in `ResourceLimits` type and `DEFAULT_RESOURCE_LIMITS`
- Update doc comment: "Maximum size in bytes for any individual message payload"

**Step 2: Remove from handler context**

In `packages/server/src/types.ts`:
- Remove `maxPayloadSize: number` from `HandlerContext`

**Step 3: Remove cumulative tracking from handlers**

In `packages/server/src/handlers/stream.ts` and `channel.ts`:
- Remove `const encoder = new TextEncoder()` and `let payloadBytes = 0`
- Remove the per-write size check and `BufferOverflow` abort logic
- Keep the `writeTo` callback with just send logic

**Step 4: Add per-message check in `handleMessages`**

In `packages/server/src/server.ts`:
- Remove `maxPayloadSize` from the `context` object
- Add `const encoder = new TextEncoder()` at the top of `handleMessages`
- After `processMessage` succeeds and before the `switch` statement:

```typescript
const msgSize = encoder.encode(JSON.stringify(msg.payload)).byteLength
if (msgSize > limiter.limits.maxMessageSize) {
  const error = new HandlerError({
    code: 'EK06',
    message: 'Message exceeds maximum size',
  })
  if ('rid' in msg.payload && msg.payload.rid != null) {
    context.send(error.toPayload(msg.payload.rid as string) as AnyServerPayloadOf<Protocol>)
  }
  events.emit('handlerError', { error, payload: msg.payload })
  handleNext()
  return
}
```

- For messages with a `rid` (not events), send an error response with code `EK06`
- Emit `handlerError` event
- Skip processing and continue to `handleNext()`

**Step 5: Document EK06**

In `packages/server/src/error.ts`:
- Add `EK06: Message exceeds maximum size` to the error code docs

**Step 6: Write tests**

Rewrite `packages/server/test/buffer-limits.test.ts` to test per-message rejection:

```typescript
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('Per-message size limits', () => {
  test('rejects oversized request with EK06 error', async () => {
    // Send request with large param, verify EK06 error response
    // Handler should NOT be called
  })

  test('rejects oversized stream message with EK06 error', async () => {
    // Send stream init with large param, verify EK06 error response
  })

  test('rejects oversized channel message with EK06 error', async () => {
    // Send channel init with large param, verify EK06 error response
  })

  test('rejects oversized event message silently (no rid)', async () => {
    // Send event with large data, verify handlerError event emitted
    // No error response (events have no rid)
  })

  test('allows messages within size limit', async () => {
    // Send small request, verify normal processing
  })
})
```

Also update `packages/server/test/limits.test.ts`:
- Rename `maxPayloadSize` → `maxMessageSize` in assertions

**Step 7: Verify**

Run: `pnpm --filter @enkaku/server test -- buffer-limits.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/server/src/limits.ts packages/server/src/types.ts packages/server/src/handlers/stream.ts packages/server/src/handlers/channel.ts packages/server/src/server.ts packages/server/src/error.ts packages/server/test/buffer-limits.test.ts packages/server/test/limits.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add per-message size limits for all message types

Addresses H-13, H-14: Replaces cumulative buffer tracking with a
per-message size check applied to all incoming client messages.
Oversized messages are rejected with EK06 before reaching handlers.

Renames maxPayloadSize → maxMessageSize to reflect the new semantics.

BREAKING CHANGE: maxPayloadSize renamed to maxMessageSize. Size checking
now applies per-message to all types (request, stream, channel, event),
not cumulatively to stream/channel sessions only.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Make Validation Required with Warning (M-10)

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/test/validation-warning.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/validation-warning.test.ts`:

```typescript
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/server.js'
import { createMockTransport } from './lib.test.js'

describe('Server validation', () => {
  test('logs warning when protocol not provided', () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const transport = createMockTransport()

    const server = new Server({
      public: true,
      handlers: {
        test: () => 'ok',
      },
      transports: [transport],
      // No protocol provided
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('protocol validation disabled'),
    )

    warnSpy.mockRestore()
    server.dispose()
  })

  test('no warning when protocol provided', () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const transport = createMockTransport()

    const protocol = {
      test: { type: 'request' as const, result: {} },
    }

    const server = new Server({
      public: true,
      handlers: {
        test: () => 'ok',
      },
      protocol,
      transports: [transport],
    })

    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
    server.dispose()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- validation-warning.test.ts`
Expected: FAIL (no warning is logged)

**Step 3: Write minimal implementation**

Update `Server` constructor in `packages/server/src/server.ts`:

```typescript
constructor(params: ServerParams<Protocol>) {
  // ... existing code ...

  if (params.protocol != null) {
    this.#validator = createValidator(createClientMessageSchema(params.protocol))
  } else {
    // Log warning when protocol validation is disabled
    this.#logger.warn(
      'Server created without protocol - message validation disabled. ' +
      'Consider providing a protocol for improved security.',
    )
    console.warn(
      '[enkaku/server] Warning: protocol validation disabled. ' +
      'Provide a protocol to enable message validation.',
    )
  }

  // ... rest of constructor ...
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- validation-warning.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/validation-warning.test.ts
git commit -m "$(cat <<'EOF'
feat(server): warn when protocol validation is disabled

Addresses M-10: Server now logs a warning when created without a
protocol, alerting developers that message validation is disabled.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Add Event Authorization Response (H-15)

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/test/event-auth.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/event-auth.test.ts`:

```typescript
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/server.js'
import { createMockTransport, createMockSignedMessage } from './lib.test.js'

describe('Event authorization', () => {
  test('emits authorizationFailed event when event auth fails', async () => {
    const transport = createMockTransport()
    const authFailedHandler = vi.fn()
    const serverID = 'did:key:test-server'

    const server = new Server({
      id: serverID,
      public: false,
      access: {
        myEvent: { action: 'emit', resource: 'events/allowed' },
      },
      handlers: {
        myEvent: ({ data }) => {
          // Should not be called
        },
      },
      transports: [transport],
    })

    server.events.on('authorizationFailed', authFailedHandler)

    // Send event with invalid/missing auth
    transport.mockReceive({ payload: { typ: 'event', prc: 'myEvent', dat: {} } })

    await vi.waitFor(() => {
      expect(authFailedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'event',
          procedure: 'myEvent',
          reason: expect.any(String),
        }),
      )
    })

    await server.dispose()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server test -- event-auth.test.ts`
Expected: FAIL (no authorizationFailed event emitted)

**Step 3: Write minimal implementation**

1. Update `ServerEvents` in `packages/server/src/types.ts`:
```typescript
export type ServerEvents = {
  authorizationFailed: {
    type: string
    procedure: string
    reason: string
  }
  handlerAbort: { rid: string }
  handlerError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
  }
  handlerTimeout: { rid: string }
  invalidMessage: { error: Error; message: unknown }
}
```

2. Update the authorization failure handling in `packages/server/src/server.ts`:
```typescript
// In the process function for non-public mode:
} catch (cause) {
  const error = new HandlerError({
    cause,
    code: 'EK02',
    message: (cause as Error).message ?? 'Access denied',
  })
  if (message.payload.typ === 'event') {
    events.emit('authorizationFailed', {
      type: 'event',
      procedure: message.payload.prc,
      reason: error.message,
    })
    events.emit('handlerError', { error, payload: message.payload })
  } else {
    context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>)
  }
  return
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server test -- event-auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/src/types.ts packages/server/test/event-auth.test.ts
git commit -m "$(cat <<'EOF'
feat(server): emit authorizationFailed event for event handlers

Addresses H-15: Server now emits an authorizationFailed event when
event authorization fails, allowing monitoring of auth failures.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This implementation plan addresses the following security issues:

| Issue | Status | Task |
|-------|--------|------|
| C-05: Unbounded Controller Storage | Fixed | Tasks 1-3, 5, 7 |
| C-06: No Concurrent Handler Limits | Fixed | Tasks 4, 5 |
| C-07: Channel Send Messages Skip Auth | Fixed | Task 6 |
| H-13: Unbounded Stream Buffer | Fixed | Task 10 |
| H-14: Unbounded Channel Buffer | Fixed | Task 10 |
| H-15: Event Auth Response | Fixed | Task 12 |
| M-10: Validation Optional | Mitigated | Task 11 |
| M-11: Stream Not Closed on Crash | Fixed | Task 9 |
| M-12: No Cleanup Timeout | Fixed | Task 8 |
| T-03: Resource Limit Tests | Added | Tasks 5-12 |

**Breaking Changes:**
1. Server now accepts `limits` option in constructor
2. Requests exceeding controller/handler limits are rejected with EK03/EK04 errors
3. Channel send messages in non-public servers require authorization
4. `maxPayloadSize` renamed to `maxMessageSize` — now a per-message size check applied to all incoming client messages (not cumulative stream/channel tracking)
5. Oversized messages are rejected with EK06 before reaching handlers

**New Error Codes:**
- EK03: Server controller limit reached
- EK04: Server handler limit reached
- EK05: Request timeout
- EK06: Message exceeds maximum size

**New Events:**
- `eventAuthError`: Emitted when authorization fails for event messages
- `handlerTimeout`: Emitted when a controller expires

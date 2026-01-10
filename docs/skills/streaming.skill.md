---
name: enkaku:streaming
description: Streaming and data flow patterns, packages, and usage examples
---

# Enkaku Streaming & Data Flow

## Packages in This Domain

**Stream Processing**: `@enkaku/stream`

**Async Utilities**: `@enkaku/async`

**Stateful Flow**: `@enkaku/flow`

**Event Handling**: `@enkaku/event`

## Key Patterns

### Pattern 1: Web Streams Transformation Pipeline

```typescript
import { createReadable, map, mapAsync, tap } from '@enkaku/stream'
import { createArraySink } from '@enkaku/stream'

// Create a data source
const [source, controller] = createReadable<number>()

// Build transformation pipeline
const [sink, result] = createArraySink<string>()

source
  .pipeThrough(tap((n) => console.log('Processing:', n)))
  .pipeThrough(map((n) => n * 2))
  .pipeThrough(mapAsync(async (n) => `Value: ${n}`))
  .pipeTo(sink)

// Feed data
controller.enqueue(1)
controller.enqueue(2)
controller.enqueue(3)
controller.close()

// result resolves to ['Value: 2', 'Value: 4', 'Value: 6']
```

**Use case**: Data transformation, processing pipelines, stream manipulation

**Key points**:
- Built on Web Streams API for cross-platform compatibility
- Composable transformations with `map`, `mapAsync`, `tap`
- Type-safe stream operations with TypeScript generics
- Automatic backpressure handling
- Works in browsers, Node.js, Deno, Bun

### Pattern 2: JSON Lines Streaming (JSONL)

```typescript
import { toJSONLines, fromJSONLines } from '@enkaku/stream'
import { createReadable, createArraySink } from '@enkaku/stream'

type Message = { id: number; text: string }

// Encoding: Objects to JSON Lines
const [source, controller] = createReadable<Message>()
const [sink, encoded] = createArraySink<string>()

source.pipeThrough(toJSONLines()).pipeTo(sink)

controller.enqueue({ id: 1, text: 'Hello' })
controller.enqueue({ id: 2, text: 'World' })
controller.close()

// encoded resolves to ['{"id":1,"text":"Hello"}\n', '{"id":2,"text":"World"}\n']

// Decoding: JSON Lines to Objects
const [jsonSource, jsonController] = createReadable<string>()
const [objectSink, decoded] = createArraySink<Message>()

jsonSource.pipeThrough(fromJSONLines<Message>()).pipeTo(objectSink)

jsonController.enqueue('{"id":1,"text":"Hello"}\n')
jsonController.enqueue('{"id":2,"text":"World"}\n')
jsonController.close()

// decoded resolves to [{ id: 1, text: 'Hello' }, { id: 2, text: 'World' }]
```

**Use case**: IPC, socket communication, log streaming, newline-delimited data

**Key points**:
- Newline-delimited JSON format (JSONL/NDJSON)
- Handles chunked data and buffering automatically
- Supports multi-line JSON with proper nesting detection
- Custom encoder/decoder functions via options
- Error handling with `onInvalidJSON` callback
- Used by Socket and Node Streams transports

### Pattern 3: Event-Driven Streams

```typescript
import { EventEmitter } from '@enkaku/event'
import { createArraySink } from '@enkaku/stream'

type Events = {
  data: { value: number }
  status: string
}

const emitter = new EventEmitter<Events>()
const controller = new AbortController()

// Convert events to readable stream
const dataStream = emitter.readable('data', {
  filter: (event) => event.value > 10,
  signal: controller.signal
})

const [sink, results] = createArraySink<{ value: number }>()
dataStream.pipeTo(sink)

// Emit events
await emitter.emit('data', { value: 5 })   // filtered out
await emitter.emit('data', { value: 15 })  // included
await emitter.emit('data', { value: 20 })  // included

controller.abort() // close stream

// results resolves to [{ value: 15 }, { value: 20 }]
```

**Use case**: Event-to-stream bridging, filtering event streams, reactive data flow

**Key points**:
- Based on Emittery for type-safe event handling
- Convert events to ReadableStream with `readable()`
- Convert WritableStream to events with `writable()`
- Filter events before streaming
- AbortSignal support for cleanup
- Pipe events between emitters

### Pattern 4: Async Resource Management

```typescript
import { Disposer } from '@enkaku/async'
import { defer, lazy } from '@enkaku/async'

// Deferred promise pattern
const { promise, resolve, reject } = defer<string>()

setTimeout(() => resolve('Done!'), 1000)
await promise // 'Done!'

// Lazy promise execution
let executionCount = 0
const lazyTask = lazy(async () => {
  executionCount++
  return 'Computed result'
})

// Not executed yet
console.log(executionCount) // 0

// Executed on first await
const result1 = await lazyTask
console.log(executionCount) // 1

// Reuses same result
const result2 = await lazyTask
console.log(executionCount) // 1

// Resource cleanup with Disposer
const disposer = new Disposer({
  dispose: async (reason) => {
    console.log('Cleaning up:', reason)
    await cleanup()
  }
})

// Use the signal to coordinate async operations
fetch('/api/data', { signal: disposer.signal })

// Later: cleanup resources
await disposer.dispose('User cancelled')
// Logs: 'Cleaning up: User cancelled'
```

**Use case**: Resource cleanup, deferred execution, lazy initialization

**Key points**:
- `defer()` creates externally resolvable promises
- `lazy()` delays execution until first await
- `Disposer` extends AbortController for cleanup coordination
- Implements AsyncDisposable for `await using` syntax
- Signal-based cancellation propagation
- Automatic disposal on parent signal abort

### Pattern 5: Stateful Flow Execution

```typescript
import { createFlow } from '@enkaku/flow'
import type { HandlerExecutionContext } from '@enkaku/flow'

type AppState = {
  count: number
  status: 'idle' | 'processing' | 'complete'
}

type IncrementParams = { amount: number }
type CompleteParams = { final: boolean }

const handlers = {
  increment: ({ state, params }: HandlerExecutionContext<AppState, IncrementParams>) => {
    const newCount = state.count + params.amount

    if (newCount >= 10) {
      return {
        status: 'action' as const,
        state: { ...state, count: newCount, status: 'processing' as const },
        action: 'complete',
        params: { final: true }
      }
    }

    return {
      status: 'state' as const,
      state: { ...state, count: newCount }
    }
  },

  complete: ({ state, params }: HandlerExecutionContext<AppState, CompleteParams>) => {
    return {
      status: 'end' as const,
      state: { ...state, status: 'complete' as const }
    }
  }
}

// Create flow generator
const generateFlow = createFlow({ handlers })

const flow = generateFlow({
  state: { count: 0, status: 'idle' },
  action: { name: 'increment', params: { amount: 5 } }
})

// Iterate through flow states
for await (const value of flow) {
  console.log(value)
  // First: { status: 'state', state: { count: 5, status: 'idle' } }

  // Continue with next action
  if (value.status === 'state') {
    await flow.next({ action: { name: 'increment', params: { amount: 6 } } })
  }
}
// Final: { status: 'end', state: { count: 11, status: 'complete' } }
```

**Use case**: State machines, workflow orchestration, multi-step processes

**Key points**:
- Async generator-based state management
- Type-safe state transitions and handler params
- Built-in validation with JSON Schema support
- Event emission during handler execution
- Abort signal support for cancellation
- Handlers return next action or terminal state
- Implements AsyncDisposable for cleanup

## When to Use What

**Use @enkaku/stream** when:
- Building data transformation pipelines
- Working with Web Streams API
- Need cross-platform streaming (browser + Node.js)
- Processing JSON Lines format
- Creating bidirectional stream pairs

**Use @enkaku/async** when:
- Need deferred promise resolution
- Want lazy evaluation of async operations
- Managing resource lifecycle and cleanup
- Coordinating cancellation across operations
- Implementing timeout mechanisms

**Use @enkaku/flow** when:
- Building state machines or workflows
- Need stateful multi-step processes
- Want type-safe state transitions
- Orchestrating complex async operations
- Require validation at each state change

**Use @enkaku/event** when:
- Implementing event-driven architecture
- Need to bridge events and streams
- Want type-safe event emitters
- Building reactive data flows
- Filtering and transforming event streams

## Related Domains

- See `/enkaku:transport` for transport-layer stream usage
- See `/enkaku:protocol` for typed stream definitions
- See `/enkaku:execution` for execution chain patterns

## Detailed Reference

For complete API documentation, advanced patterns, and integration examples: `docs/capabilities/domains/streaming.md`

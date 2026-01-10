# Streaming & Data Flow - Detailed Reference

## Overview

The Streaming & Data Flow domain in Enkaku provides comprehensive tools for asynchronous data processing, event handling, and stateful workflow orchestration. Built on modern Web Standards (Web Streams API, AbortSignal, AsyncDisposable), these packages work seamlessly across all JavaScript runtimes while providing type safety and composability.

This domain handles four core concerns: stream transformation (`@enkaku/stream`), async utilities and resource management (`@enkaku/async`), stateful flow execution (`@enkaku/flow`), and event-driven patterns (`@enkaku/event`).

## Package Ecosystem

### Stream Processing: @enkaku/stream

**Purpose**: Web Streams utilities for data transformation and transport integration.

**Key exports**:
- `createReadable<T>()` - Create ReadableStream with controller access
- `createPipe<T>()` - Create bidirectional ReadableWritablePair
- `createConnection<AtoB, BtoA>()` - Create connected stream pair
- `writeTo<T>(write, close, abort)` - Create WritableStream from callbacks
- `createArraySink<T>()` - Create WritableStream that collects to array
- `transform<I, O>(callback, flush)` - Create custom TransformStream
- `map<I, O>(handler)` - Synchronous transformation stream
- `mapAsync<I, O>(handler)` - Async transformation stream
- `tap<T>(handler)` - Side-effect stream (passthrough)
- `toJSONLines<T>(encode?)` - Encode objects to JSON Lines format
- `fromJSONLines<T>(options?)` - Decode JSON Lines to objects
- `JSONLinesError` - Error class for JSON Lines parsing

**Dependencies**: `@enkaku/async`

**Core concepts**:
- All utilities build on Web Streams API (ReadableStream, WritableStream, TransformStream)
- Type-safe generic parameters for input/output types
- Composable transformations via `pipeThrough()`
- Automatic backpressure handling
- Works identically in browser and Node.js

**Platform support**: All modern JavaScript runtimes (browsers, Node.js 18+, Deno, Bun)

### Async Utilities: @enkaku/async

**Purpose**: Promise utilities, resource management, and async control flow.

**Key exports**:
- `defer<T, R>()` - Create Deferred object with external resolve/reject
- `Deferred<T, R>` - Type for deferred promise
- `lazy<T>(execute)` - Create lazy promise that executes on first await
- `LazyPromise<T>` - Promise subclass with lazy execution
- `Disposer` - Resource cleanup with AbortController integration
- `DisposerParams` - Configuration for Disposer
- `ScheduledTimeout` - Disposable timeout with AbortSignal
- `Interruption` - Base error class for interruptions
- `AbortInterruption` - Abort-specific interruption
- `CancelInterruption` - Cancellation interruption
- `DisposeInterruption` - Disposal interruption
- `TimeoutInterruption` - Timeout interruption
- `toPromise<T>(execute)` - Convert sync/async function to Promise
- `raceSignal<T>(promise, signal)` - Race promise against AbortSignal
- `sleep(delay)` - Promise-based delay

**Dependencies**: None (zero dependencies)

**Core concepts**:
- External promise resolution with `defer()`
- Lazy evaluation to defer expensive operations
- Signal-based cancellation propagation
- Disposable pattern for resource cleanup
- Typed interruption errors for different abort scenarios

**Platform support**: All JavaScript runtimes

### Stateful Flow: @enkaku/flow

**Purpose**: State machine and workflow orchestration with async generators.

**Key exports**:
- `createFlow<State, Handlers>(params)` - Create flow generator factory
- `createGenerator<State, Handlers>(params)` - Create flow generator directly
- `FlowGenerator<State, Handlers>` - Generator with state management
- `FlowAction<State, Handlers, Action>` - Action type for handler invocation
- `Handler<State, Params, Events>` - Handler function type
- `HandlersRecord<State, Events>` - Record of handler functions
- `HandlerExecutionContext<State, Params, Events>` - Context passed to handlers
- `GeneratorValue<State, Params>` - Non-terminal generator values
- `GeneratorDoneValue<State>` - Terminal generator values (end/error/aborted)
- `MissingHandlerError` - Error for undefined handlers

**Dependencies**: `@enkaku/event`, `@enkaku/schema`

**Core concepts**:
- Async generator-based state machines
- Handlers return next state + optional action
- State validation via JSON Schema (optional)
- Event emission during execution
- AbortSignal support for cancellation
- Type-safe handler parameters

**Platform support**: All JavaScript runtimes

### Event Handling: @enkaku/event

**Purpose**: Type-safe event emitter with stream integration.

**Key exports**:
- `EventEmitter<Events, AllEvents>` - Type-safe event emitter class
- `Options` - Re-export of Emittery options
- `UnsubscribeFunction` - Type for unsubscribe callback

**Methods**:
- `on<Name>(eventName, listener, options?)` - Subscribe to events
- `emit<Name>(eventName, eventData)` - Emit events
- `readable<Name>(name, options?)` - Convert events to ReadableStream
- `writable<Name>(name)` - Convert WritableStream to events
- Plus all Emittery methods (once, off, etc.)

**Dependencies**: `emittery` (peer: `@enkaku/stream` for tests)

**Core concepts**:
- Based on Emittery for type-safe event handling
- Filter events before delivery
- Bridge events to Web Streams
- AbortSignal-based subscription cleanup
- Structured clone for event data

**Platform support**: All JavaScript runtimes

## Common Patterns

### Pattern: Building a Data Processing Pipeline

**Use case**: Transform streaming data through multiple stages with type safety

**Implementation**:

```typescript
import { createReadable, map, mapAsync, tap } from '@enkaku/stream'

// Define types for pipeline stages
type RawData = { timestamp: number; value: string }
type Parsed = { timestamp: Date; value: number }
type Enriched = Parsed & { normalized: number }

// Create source
const [source, controller] = createReadable<RawData>()

// Build multi-stage pipeline
const pipeline = source
  .pipeThrough(tap((raw) => console.log('Received:', raw)))
  .pipeThrough(map<RawData, Parsed>((raw) => ({
    timestamp: new Date(raw.timestamp),
    value: Number.parseFloat(raw.value)
  })))
  .pipeThrough(mapAsync<Parsed, Enriched>(async (parsed) => {
    const stats = await fetchStats() // async operation
    return {
      ...parsed,
      normalized: parsed.value / stats.max
    }
  })))

// Connect to destination
const reader = pipeline.getReader()

// Feed data
controller.enqueue({ timestamp: Date.now(), value: '42.5' })
controller.enqueue({ timestamp: Date.now(), value: '38.2' })
controller.close()

// Consume results
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log('Processed:', value)
}
```

**Why this works**:
- Each stage has explicit input/output types
- Transformations are composable and reusable
- Automatic backpressure if async operations slow down
- Side effects isolated to `tap()` stages
- Can be tested by mocking individual stages

### Pattern: JSON Lines Streaming for IPC

**Use case**: Communicate between processes using newline-delimited JSON

**Implementation**:

```typescript
import { toJSONLines, fromJSONLines, createPipe } from '@enkaku/stream'

type Request = { method: string; params: unknown }
type Response = { result: unknown } | { error: string }

// Process A: Send requests
const { readable: requestSource, writable: requestSink } = createPipe<Request>()

requestSource
  .pipeThrough(toJSONLines())
  .pipeTo(/* process.stdout or socket */)

const writer = requestSink.getWriter()
await writer.write({ method: 'getUser', params: { id: 123 } })

// Process B: Receive and process requests
const responseStream = /* process.stdin or socket */
  .pipeThrough(fromJSONLines<Request>({
    onInvalidJSON: (value, controller) => {
      console.error('Invalid JSON:', value)
      // Optionally enqueue error response
      controller.enqueue({ error: 'Invalid JSON' })
    }
  }))

for await (const request of responseStream) {
  const response = await handleRequest(request)
  // Send response back...
}
```

**Why this works**:
- Handles chunked data automatically (buffering across newlines)
- Supports multi-line formatted JSON
- Error handling for malformed JSON
- Compatible with Unix pipes and sockets
- No need to implement framing protocol

### Pattern: Resource Lifecycle Management

**Use case**: Coordinate cleanup of multiple async resources

**Implementation**:

```typescript
import { Disposer } from '@enkaku/async'
import { ScheduledTimeout } from '@enkaku/async'

async function processWithTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  // Create disposer to manage cleanup
  const disposer = new Disposer({
    dispose: async (reason) => {
      console.log('Cleanup triggered:', reason)
      await cleanupResources()
    }
  })

  // Create timeout that aborts the signal
  using timeout = ScheduledTimeout.in(timeoutMs, {
    message: `Operation timed out after ${timeoutMs}ms`
  })

  try {
    // Combine signals: timeout OR disposer abort
    const combinedSignal = AbortSignal.any([
      timeout.signal,
      disposer.signal
    ])

    // Run operation with combined signal
    const result = await operation(combinedSignal)

    return result
  } catch (error) {
    if (error instanceof TimeoutInterruption) {
      console.error('Operation timed out')
    }
    throw error
  } finally {
    // Ensure cleanup
    await disposer.dispose()
  }
}

// Usage
const result = await processWithTimeout(
  async (signal) => {
    const response = await fetch('/api/data', { signal })
    return response.json()
  },
  5000 // 5 second timeout
)
```

**Why this works**:
- Single cleanup point via Disposer
- Timeout automatically aborts via signal
- Using statement ensures timeout cleanup
- Type-safe interruption errors
- Multiple signals combined with `AbortSignal.any()`

### Pattern: Event Stream Filtering and Transformation

**Use case**: Convert events to streams with filtering and backpressure

**Implementation**:

```typescript
import { EventEmitter } from '@enkaku/event'
import { map } from '@enkaku/stream'

type SensorEvents = {
  temperature: { sensor: string; celsius: number }
  pressure: { sensor: string; pascals: number }
}

const sensors = new EventEmitter<SensorEvents>()

// Create filtered stream of high temperatures
const controller = new AbortController()

const highTempStream = sensors
  .readable('temperature', {
    filter: (reading) => reading.celsius > 30,
    signal: controller.signal
  })
  .pipeThrough(map((reading) => ({
    ...reading,
    fahrenheit: (reading.celsius * 9/5) + 32
  })))

// Process high temperature readings
for await (const reading of highTempStream) {
  await alertHighTemperature(reading)
  // Backpressure: won't process next reading until alert completes
}

// Meanwhile, emit events
await sensors.emit('temperature', { sensor: 'A', celsius: 25 }) // filtered
await sensors.emit('temperature', { sensor: 'B', celsius: 35 }) // included
await sensors.emit('pressure', { sensor: 'A', pascals: 101325 }) // different event

// Stop processing
controller.abort()
```

**Why this works**:
- Filters events before they enter stream
- Automatic backpressure if processing is slow
- Clean shutdown with AbortSignal
- Type-safe event names and payloads
- Compose with other stream transformations

### Pattern: State Machine Workflow

**Use case**: Multi-step process with conditional transitions

**Implementation**:

```typescript
import { createFlow } from '@enkaku/flow'
import { createValidator } from '@enkaku/schema'
import type { HandlerExecutionContext } from '@enkaku/flow'

// Define state shape
type OrderState = {
  orderId: string
  items: Array<{ id: string; quantity: number }>
  total: number
  paymentStatus: 'pending' | 'authorized' | 'captured'
  shippingStatus: 'pending' | 'shipped' | 'delivered'
}

// Define parameter types
type AuthorizeParams = { paymentMethod: string }
type CaptureParams = { amount: number }
type ShipParams = { carrier: string; trackingId: string }

// Define handlers
const handlers = {
  authorizePayment: async ({
    state,
    params,
    signal
  }: HandlerExecutionContext<OrderState, AuthorizeParams>) => {
    const authorized = await authorizePayment(params.paymentMethod, { signal })

    if (!authorized) {
      return {
        status: 'error' as const,
        state,
        error: new Error('Payment authorization failed')
      }
    }

    return {
      status: 'action' as const,
      state: { ...state, paymentStatus: 'authorized' as const },
      action: 'capturePayment',
      params: { amount: state.total }
    }
  },

  capturePayment: async ({
    state,
    params,
    signal
  }: HandlerExecutionContext<OrderState, CaptureParams>) => {
    await capturePayment(state.orderId, params.amount, { signal })

    return {
      status: 'action' as const,
      state: { ...state, paymentStatus: 'captured' as const },
      action: 'shipOrder',
      params: { carrier: 'USPS', trackingId: await generateTracking() }
    }
  },

  shipOrder: async ({
    state,
    params,
    signal
  }: HandlerExecutionContext<OrderState, ShipParams>) => {
    await createShipment(state.orderId, params, { signal })

    return {
      status: 'end' as const,
      state: { ...state, shippingStatus: 'shipped' as const }
    }
  }
}

// Create flow factory
const processOrder = createFlow({
  handlers,
  stateValidator: createValidator({
    type: 'object',
    properties: {
      orderId: { type: 'string' },
      items: { type: 'array' },
      total: { type: 'number' },
      paymentStatus: { enum: ['pending', 'authorized', 'captured'] },
      shippingStatus: { enum: ['pending', 'shipped', 'delivered'] }
    },
    required: ['orderId', 'items', 'total', 'paymentStatus', 'shippingStatus']
  })
})

// Execute flow
const flow = processOrder({
  state: {
    orderId: 'ORD-123',
    items: [{ id: 'ITEM-1', quantity: 2 }],
    total: 99.99,
    paymentStatus: 'pending',
    shippingStatus: 'pending'
  },
  action: { name: 'authorizePayment', params: { paymentMethod: 'card_xxx' } }
})

// Listen to flow events
flow.events.on('*', (event) => {
  console.log('Flow event:', event)
})

// Iterate through states
for await (const value of flow) {
  console.log('State:', value.status, value.state)

  if (value.status === 'error') {
    console.error('Flow failed:', value.error)
    break
  }

  if (value.status === 'end') {
    console.log('Order completed:', value.state)
    break
  }
}
```

**Why this works**:
- Type-safe state transitions
- Each handler decides next action
- Automatic state validation
- AbortSignal propagates through all steps
- Event emission for monitoring
- Errors stop the flow gracefully

## Package Interactions

### Stream + Transport Integration

The stream package provides primitives used by all transport implementations:

```typescript
import { createConnection } from '@enkaku/stream'
import { DirectTransports } from '@enkaku/transport'

// DirectTransports internally uses createConnection
const [clientSide, serverSide] = createConnection<ToServer, ToClient>()

// Socket transport uses toJSONLines/fromJSONLines
import { toJSONLines, fromJSONLines } from '@enkaku/stream'
import { SocketTransport } from '@enkaku/socket-transport'

// Internally: socket readable -> fromJSONLines() -> messages
// Internally: messages -> toJSONLines() -> socket writable
```

### Async + All Packages

Async utilities are foundational across the codebase:

```typescript
import { defer } from '@enkaku/async'
import { Disposer } from '@enkaku/async'

// Stream package uses defer() for createArraySink
// Transport uses Disposer for resource cleanup
// Flow uses Disposer pattern for generator disposal
```

### Event + Flow Integration

Flow emits events during handler execution:

```typescript
import { createFlow } from '@enkaku/flow'
import type { HandlerExecutionContext } from '@enkaku/flow'

type Events = {
  progress: { step: string; percent: number }
}

const handlers = {
  process: async ({ state, emit }: HandlerExecutionContext<State, Params, Events>) => {
    await emit('progress', { step: 'validation', percent: 25 })
    // ... processing
    await emit('progress', { step: 'complete', percent: 100 })

    return { status: 'end' as const, state }
  }
}

const flow = createGenerator({ handlers, state: initialState })

// Subscribe to progress events
flow.events.on('progress', (event) => {
  console.log(`${event.step}: ${event.percent}%`)
})
```

### Event + Stream Bridging

Events can be converted to streams and vice versa:

```typescript
import { EventEmitter } from '@enkaku/event'

const emitter = new EventEmitter<{ data: number }>()

// Events -> Stream
const readable = emitter.readable('data')

// Stream -> Events
const writable = emitter.writable('data')

// Pipe between emitters
const emitter2 = new EventEmitter<{ output: number }>()
emitter.readable('data').pipeTo(emitter2.writable('output'))
```

## API Quick Reference

### @enkaku/stream

```typescript
// Stream creation
createReadable<T>(cancel?): [ReadableStream<T>, ReadableStreamDefaultController<T>]
createPipe<T>(): ReadableWritablePair<T, T>
createConnection<AtoB, BtoA>(): [ReadableWritablePair<BtoA, AtoB>, ReadableWritablePair<AtoB, BtoA>]
writeTo<T>(write, close?, abort?): WritableStream<T>
createArraySink<T>(): [WritableStream<T>, Promise<Array<T>>]

// Transformations
transform<I, O>(callback, flush?): TransformStream<I, O>
map<I, O>(handler: (input: I) => O): TransformStream<I, O>
mapAsync<I, O>(handler: (input: I) => O | PromiseLike<O>): TransformStream<I, O>
tap<T>(handler: (value: T) => void): TransformStream<T, T>

// JSON Lines
toJSONLines<T>(encode?): TransformStream<T, string>
fromJSONLines<T>(options?): TransformStream<Uint8Array | string, T>
```

### @enkaku/async

```typescript
// Promises
defer<T, R>(): Deferred<T, R>
lazy<T>(execute: () => T | PromiseLike<T>): LazyPromise<T>
toPromise<T>(execute: () => T | PromiseLike<T>): Promise<T>
raceSignal<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T>
sleep(delay: number): Promise<void>

// Resource management
new Disposer(params?: DisposerParams)
disposer.dispose(reason?): Promise<void>
disposer.disposed: Promise<void>
disposer.signal: AbortSignal

// Timeouts
ScheduledTimeout.at(date, options?): ScheduledTimeout
ScheduledTimeout.in(delay, options?): ScheduledTimeout
timeout.signal: AbortSignal
timeout.cancel(): void

// Interruptions
new Interruption(options?)
new AbortInterruption(options?)
new CancelInterruption(options?)
new DisposeInterruption(options?)
new TimeoutInterruption(options?)
```

### @enkaku/flow

```typescript
// Flow creation
createFlow<State, Handlers>(params): (params) => FlowGenerator<State, Handlers>
createGenerator<State, Handlers>(params): FlowGenerator<State, Handlers>

// Generator interface
generator.next(step?): Promise<IteratorResult<GeneratorValue<State>>>
generator.return(value?): Promise<IteratorResult<GeneratorDoneValue<State>>>
generator.throw(error?): Promise<IteratorResult<GeneratorDoneValue<State>>>
generator.getState(): Readonly<State>
generator.events: EventEmitter<HandlersEvents<State, Handlers>>

// Handler signature
type Handler<State, Params, Events> = (
  context: HandlerExecutionContext<State, Params, Events>
) => GeneratorValue<State> | Promise<GeneratorValue<State>>
```

### @enkaku/event

```typescript
// EventEmitter
new EventEmitter<Events, AllEvents>()
emitter.on<Name>(eventName, listener, options?)
emitter.once<Name>(eventName)
emitter.emit<Name>(eventName, eventData)
emitter.off<Name>(eventName, listener?)
emitter.readable<Name>(name, options?): ReadableStream<Events[Name]>
emitter.writable<Name>(name): WritableStream<Events[Name]>
```

## Scenarios

### Scenario 1: Real-Time Log Processing

**Goal**: Process server logs in real-time, filter errors, and alert on patterns

```typescript
import { fromJSONLines, map, tap } from '@enkaku/stream'
import { EventEmitter } from '@enkaku/event'

type LogEntry = {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, unknown>
}

type AlertEvents = {
  error: { entry: LogEntry; count: number }
}

const alerts = new EventEmitter<AlertEvents>()

// Connect to log stream (e.g., from stdin or socket)
const logStream = process.stdin
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(fromJSONLines<LogEntry>())
  .pipeThrough(tap((entry) => {
    // Side effect: store to database
    storeLog(entry)
  }))

// Track error counts
const errorCounts = new Map<string, number>()

// Process errors
for await (const entry of logStream) {
  if (entry.level === 'error') {
    const key = entry.message
    const count = (errorCounts.get(key) || 0) + 1
    errorCounts.set(key, count)

    if (count >= 5) {
      await alerts.emit('error', { entry, count })
      errorCounts.delete(key) // Reset after alert
    }
  }
}

// Alert handler
alerts.on('error', async ({ entry, count }) => {
  await sendAlert({
    severity: 'high',
    message: `Error occurred ${count} times: ${entry.message}`
  })
})
```

### Scenario 2: Multi-Step File Processing Workflow

**Goal**: Upload file, process it, validate results, and update database

```typescript
import { createFlow } from '@enkaku/flow'
import { Disposer } from '@enkaku/async'
import type { HandlerExecutionContext } from '@enkaku/flow'

type FileState = {
  fileId: string
  path?: string
  processed?: boolean
  validated?: boolean
  status: 'uploading' | 'processing' | 'validating' | 'complete' | 'failed'
}

type UploadParams = { file: File }
type ProcessParams = { options: Record<string, unknown> }
type ValidateParams = Record<string, never>

const handlers = {
  upload: async ({ state, params, signal }: HandlerExecutionContext<FileState, UploadParams>) => {
    const path = await uploadFile(params.file, { signal })

    return {
      status: 'action' as const,
      state: { ...state, path, status: 'processing' as const },
      action: 'process',
      params: { options: { quality: 'high' } }
    }
  },

  process: async ({ state, params, signal }: HandlerExecutionContext<FileState, ProcessParams>) => {
    if (!state.path) throw new Error('No file path')

    await processFile(state.path, params.options, { signal })

    return {
      status: 'action' as const,
      state: { ...state, processed: true, status: 'validating' as const },
      action: 'validate',
      params: {}
    }
  },

  validate: async ({ state, signal }: HandlerExecutionContext<FileState, ValidateParams>) => {
    if (!state.path) throw new Error('No file path')

    const valid = await validateFile(state.path, { signal })

    if (!valid) {
      return {
        status: 'error' as const,
        state: { ...state, status: 'failed' as const },
        error: new Error('Validation failed')
      }
    }

    await updateDatabase(state.fileId, { processed: true, validated: true })

    return {
      status: 'end' as const,
      state: { ...state, validated: true, status: 'complete' as const }
    }
  }
}

// Execute with timeout
async function processFileWithTimeout(file: File, timeoutMs: number) {
  using timeout = ScheduledTimeout.in(timeoutMs)

  const processFile = createFlow({ handlers })

  const flow = processFile({
    signal: timeout.signal,
    state: {
      fileId: generateId(),
      status: 'uploading'
    },
    action: { name: 'upload', params: { file } }
  })

  for await (const value of flow) {
    console.log('Status:', value.status)

    if (value.status === 'error') {
      console.error('Processing failed:', value.error)
      throw value.error
    }

    if (value.status === 'aborted') {
      console.error('Processing aborted:', value.reason)
      throw new Error('Timeout exceeded')
    }

    if (value.status === 'end') {
      console.log('Processing complete:', value.state)
      return value.state
    }
  }
}
```

### Scenario 3: Event-Driven Data Aggregation

**Goal**: Aggregate sensor data over time windows and emit summaries

```typescript
import { EventEmitter } from '@enkaku/event'
import { map } from '@enkaku/stream'
import { ScheduledTimeout } from '@enkaku/async'

type SensorReading = {
  sensorId: string
  temperature: number
  humidity: number
  timestamp: number
}

type Summary = {
  sensorId: string
  avgTemperature: number
  avgHumidity: number
  count: number
  windowStart: number
  windowEnd: number
}

const readings = new EventEmitter<{ reading: SensorReading }>()
const summaries = new EventEmitter<{ summary: Summary }>()

// Aggregate readings in 5-minute windows
async function aggregateSensorData() {
  const windows = new Map<string, Array<SensorReading>>()

  // Create timeout for window
  using windowTimer = ScheduledTimeout.in(5 * 60 * 1000) // 5 minutes

  const readingStream = readings.readable('reading', {
    signal: windowTimer.signal
  })

  try {
    for await (const reading of readingStream) {
      const key = reading.sensorId
      const buffer = windows.get(key) || []
      buffer.push(reading)
      windows.set(key, buffer)
    }
  } catch (error) {
    if (error instanceof TimeoutInterruption) {
      // Window closed - emit summaries
      const now = Date.now()

      for (const [sensorId, buffer] of windows) {
        if (buffer.length === 0) continue

        const summary: Summary = {
          sensorId,
          avgTemperature: buffer.reduce((sum, r) => sum + r.temperature, 0) / buffer.length,
          avgHumidity: buffer.reduce((sum, r) => sum + r.humidity, 0) / buffer.length,
          count: buffer.length,
          windowStart: now - (5 * 60 * 1000),
          windowEnd: now
        }

        await summaries.emit('summary', summary)
      }

      // Start next window
      aggregateSensorData()
    }
  }
}

// Start aggregation
aggregateSensorData()

// Emit readings
await readings.emit('reading', {
  sensorId: 'sensor-1',
  temperature: 22.5,
  humidity: 45,
  timestamp: Date.now()
})

// Subscribe to summaries
summaries.on('summary', (summary) => {
  console.log('Window summary:', summary)
  storeSummary(summary)
})
```

## Troubleshooting

### Stream not consuming data

**Problem**: Created a stream but data isn't being processed

**Solution**: Ensure stream is connected to sink or being read

```typescript
import { createReadable, map } from '@enkaku/stream'

const [source, controller] = createReadable<number>()

// BAD: Transformation created but not consumed
source.pipeThrough(map((n) => n * 2))
controller.enqueue(1) // Nothing happens

// GOOD: Connect to sink
const [sink, result] = createArraySink()
source.pipeThrough(map((n) => n * 2)).pipeTo(sink)
controller.enqueue(1) // Processed
controller.close()
await result // [2]

// ALSO GOOD: Read directly
const reader = source.pipeThrough(map((n) => n * 2)).getReader()
controller.enqueue(1)
const { value } = await reader.read() // value: 2
```

### JSON Lines parsing incomplete

**Problem**: `fromJSONLines()` not emitting values

**Solution**: Ensure data includes newline separators

```typescript
import { fromJSONLines } from '@enkaku/stream'

const [source, controller] = createReadable<string>()
const [sink, result] = createArraySink()

source.pipeThrough(fromJSONLines()).pipeTo(sink)

// BAD: Missing newline - buffered until close
controller.enqueue('{"test": "value"}')

// GOOD: Include newline to flush
controller.enqueue('{"test": "value"}\n')

// OR: Close to flush buffer
controller.close() // Flushes any buffered JSON
```

### Memory leak with event listeners

**Problem**: Event listeners not cleaned up

**Solution**: Use AbortSignal or unsubscribe

```typescript
import { EventEmitter } from '@enkaku/event'

const emitter = new EventEmitter<{ data: string }>()

// BAD: Listener never removed
emitter.on('data', (value) => console.log(value))

// GOOD: Use AbortSignal
const controller = new AbortController()
emitter.on('data', (value) => console.log(value), {
  signal: controller.signal
})
// Later: cleanup
controller.abort()

// ALSO GOOD: Use unsubscribe function
const unsubscribe = emitter.on('data', (value) => console.log(value))
// Later: cleanup
unsubscribe()
```

### Flow stuck in infinite loop

**Problem**: Flow generator never terminates

**Solution**: Ensure handlers return terminal status

```typescript
import { createFlow } from '@enkaku/flow'

// BAD: Handlers always return 'action' status
const badHandlers = {
  step1: ({ state, params }) => ({
    status: 'action' as const,
    state,
    action: 'step2',
    params: {}
  }),
  step2: ({ state, params }) => ({
    status: 'action' as const,
    state,
    action: 'step1', // Infinite loop!
    params: {}
  })
}

// GOOD: Ensure terminal state
const goodHandlers = {
  step1: ({ state, params }) => ({
    status: 'action' as const,
    state,
    action: 'step2',
    params: {}
  }),
  step2: ({ state, params }) => ({
    status: 'end' as const, // Terminates
    state
  })
}
```

### Lazy promise executing too early

**Problem**: Lazy promise executes before needed

**Solution**: Don't await or call `.then()` until ready

```typescript
import { lazy } from '@enkaku/async'

// BAD: Executes immediately
const result = await lazy(() => expensiveOperation())

// GOOD: Store lazy promise, execute later
const lazyResult = lazy(() => expensiveOperation())
// ... do other work ...
const result = await lazyResult // NOW it executes
```

### Disposer not cleaning up

**Problem**: Resources not released on abort

**Solution**: Pass signal to async operations

```typescript
import { Disposer } from '@enkaku/async'

const disposer = new Disposer({
  dispose: async () => {
    await cleanup()
  }
})

// BAD: Operation ignores signal
fetch('/api/data') // Won't abort

// GOOD: Pass signal to operation
fetch('/api/data', { signal: disposer.signal }) // Aborts on dispose

await disposer.dispose() // Cleanup runs and fetch aborts
```

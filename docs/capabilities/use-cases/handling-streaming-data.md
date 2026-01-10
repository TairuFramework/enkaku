# Handling Streaming Data

## Goal

Learn how to process and transform streaming data in Enkaku by building a real-time data pipeline that processes server logs, transforms them through multiple stages, handles backpressure, recovers from errors, and outputs results in JSON Lines format. You'll use Web Streams primitives, transformation utilities, error handling patterns, and practical streaming techniques that work across all JavaScript runtimes.

## Prerequisites

Install the required packages:

```bash
pnpm add @enkaku/stream @enkaku/async @enkaku/event
```

## Step-by-Step Implementation

### Step 1: Create a Basic Stream Pipeline

Start by creating a simple stream that processes data through transformation stages.

```typescript
// pipeline/basic.ts
import { createReadable, map, tap } from '@enkaku/stream'

// Define data types for each stage
type RawLog = {
  timestamp: number
  level: string
  message: string
}

type ParsedLog = {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

// Create a readable stream with controller
const [logStream, controller] = createReadable<RawLog>()

// Build transformation pipeline
const pipeline = logStream
  // Stage 1: Side-effect logging
  .pipeThrough(tap((raw) => {
    console.log('Received raw log:', raw)
  }))
  // Stage 2: Parse and validate
  .pipeThrough(map<RawLog, ParsedLog>((raw) => {
    const validLevels = ['debug', 'info', 'warn', 'error']
    const level = validLevels.includes(raw.level)
      ? (raw.level as ParsedLog['level'])
      : 'info'

    return {
      timestamp: new Date(raw.timestamp),
      level,
      message: raw.message
    }
  }))
  // Stage 3: Filter out debug logs
  .pipeThrough(new TransformStream<ParsedLog, ParsedLog>({
    transform(log, controller) {
      if (log.level !== 'debug') {
        controller.enqueue(log)
      }
    }
  }))

// Consume the pipeline
async function consumePipeline() {
  const reader = pipeline.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      console.log('Processed log:', {
        time: value.timestamp.toISOString(),
        level: value.level,
        message: value.message
      })
    }
  } finally {
    reader.releaseLock()
  }
}

// Start consuming
consumePipeline()

// Feed data into the stream
controller.enqueue({
  timestamp: Date.now(),
  level: 'info',
  message: 'Server started'
})

controller.enqueue({
  timestamp: Date.now(),
  level: 'debug',
  message: 'Debug info'  // Will be filtered out
})

controller.enqueue({
  timestamp: Date.now(),
  level: 'error',
  message: 'Connection failed'
})

// Close the stream
controller.close()
```

**Key points:**
- Use `createReadable()` to create a stream with external control
- Chain transformations with `pipeThrough()`
- `tap()` for side effects without modifying data
- `map()` for synchronous transformations
- Custom `TransformStream` for filtering
- Always release locks in `finally` blocks

### Step 2: Handle Async Transformations

Add async operations like database lookups or API calls to your pipeline.

```typescript
// pipeline/async.ts
import { createReadable, mapAsync, tap } from '@enkaku/stream'

type LogEntry = {
  userId: string
  action: string
  timestamp: number
}

type EnrichedLog = LogEntry & {
  userName: string
  userEmail: string
}

// Simulate async database lookup
async function getUserDetails(userId: string): Promise<{ name: string; email: string }> {
  await new Promise(resolve => setTimeout(resolve, 100)) // Simulate delay

  return {
    name: `User ${userId}`,
    email: `user${userId}@example.com`
  }
}

const [source, controller] = createReadable<LogEntry>()

// Pipeline with async transformation
const enrichedPipeline = source
  .pipeThrough(tap((entry) => {
    console.log(`Processing action: ${entry.action} for user ${entry.userId}`)
  }))
  .pipeThrough(mapAsync<LogEntry, EnrichedLog>(async (entry) => {
    // Async operation to enrich data
    const userDetails = await getUserDetails(entry.userId)

    return {
      ...entry,
      userName: userDetails.name,
      userEmail: userDetails.email
    }
  }))

// Consume with backpressure handling
async function processWithBackpressure() {
  const reader = enrichedPipeline.getReader()

  try {
    while (true) {
      // This read will wait for async transformations to complete
      const { done, value } = await reader.read()
      if (done) break

      console.log('Enriched log:', value)

      // Simulate slow processing (backpressure)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  } finally {
    reader.releaseLock()
  }
}

processWithBackpressure()

// Feed data quickly
for (let i = 1; i <= 5; i++) {
  controller.enqueue({
    userId: `${i}`,
    action: 'login',
    timestamp: Date.now()
  })
}

controller.close()
```

**Key points:**
- Use `mapAsync()` for asynchronous transformations
- Backpressure is automatic - fast producers wait for slow consumers
- Each stage can have different processing speeds
- The pipeline automatically buffers data between stages
- Slow readers control the pace of the entire pipeline

### Step 3: Implement Error Handling and Recovery

Add robust error handling to prevent pipeline failures.

```typescript
// pipeline/error-handling.ts
import { createReadable, transform, tap } from '@enkaku/stream'
import { Interruption } from '@enkaku/async'

type DataPoint = {
  value: string
  source: string
}

type ValidatedData = {
  value: number
  source: string
  validated: true
}

class ValidationError extends Error {
  constructor(
    message: string,
    public readonly data: DataPoint
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

const [dataStream, controller] = createReadable<DataPoint>()

// Create error-resilient transform
const validationTransform = transform<DataPoint, ValidatedData>(
  async (chunk, controller) => {
    try {
      // Attempt to parse value
      const numValue = Number.parseFloat(chunk.value)

      if (Number.isNaN(numValue)) {
        throw new ValidationError(
          `Invalid number: ${chunk.value}`,
          chunk
        )
      }

      controller.enqueue({
        value: numValue,
        source: chunk.source,
        validated: true
      })
    } catch (error) {
      if (error instanceof ValidationError) {
        // Log error but continue processing
        console.error(`Validation failed for ${chunk.source}:`, error.message)

        // Optionally enqueue a default value
        controller.enqueue({
          value: 0,
          source: chunk.source,
          validated: true
        })
      } else {
        // Propagate unexpected errors
        controller.error(error)
      }
    }
  },
  (controller) => {
    // Flush function - called when stream closes
    console.log('Validation transform completed')
  }
)

// Pipeline with error handling
const resilientPipeline = dataStream
  .pipeThrough(validationTransform)
  .pipeThrough(tap((data) => {
    console.log(`Validated: ${data.source} = ${data.value}`)
  }))

// Consume with error recovery
async function processWithErrorHandling() {
  const reader = resilientPipeline.getReader()

  try {
    while (true) {
      const result = await reader.read().catch((error) => {
        console.error('Stream error:', error)
        return { done: true as const, value: undefined }
      })

      if (result.done) break

      // Process valid data
      console.log('Processing:', result.value)
    }
  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    reader.releaseLock()
  }
}

processWithErrorHandling()

// Feed mix of valid and invalid data
controller.enqueue({ value: '42.5', source: 'sensor-1' })    // Valid
controller.enqueue({ value: 'invalid', source: 'sensor-2' }) // Invalid - will use default
controller.enqueue({ value: '100', source: 'sensor-3' })     // Valid
controller.enqueue({ value: 'abc', source: 'sensor-4' })     // Invalid - will use default

controller.close()
```

**Key points:**
- Use `transform()` to create custom error-handling logic
- Catch errors inside transform to prevent pipeline failure
- Use `controller.error()` for fatal errors
- Use `controller.enqueue()` for recovery with default values
- Flush function runs when stream closes normally
- Wrap `read()` calls in try/catch for error recovery

### Step 4: Process JSON Lines Streams

Handle newline-delimited JSON for inter-process communication.

```typescript
// pipeline/json-lines.ts
import { createReadable, toJSONLines, fromJSONLines, tap } from '@enkaku/stream'

type LogMessage = {
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: number
}

// Example 1: Writing JSON Lines
async function writeJSONLines() {
  const [source, controller] = createReadable<LogMessage>()

  const jsonLinesPipeline = source
    .pipeThrough(toJSONLines<LogMessage>())
    .pipeThrough(tap((line) => {
      console.log('JSON Line:', line)
    }))

  // Consume and collect output
  const reader = jsonLinesPipeline.getReader()
  const lines: Array<string> = []

  controller.enqueue({
    level: 'info',
    message: 'Application started',
    timestamp: Date.now()
  })

  controller.enqueue({
    level: 'warn',
    message: 'High memory usage',
    timestamp: Date.now()
  })

  controller.close()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    lines.push(value)
  }

  return lines.join('')
}

// Example 2: Reading JSON Lines with error handling
async function readJSONLines(input: string) {
  const [source, controller] = createReadable<string>()

  const parsePipeline = source
    .pipeThrough(fromJSONLines<LogMessage>({
      onInvalidJSON: (invalidLine, transformController) => {
        console.error('Invalid JSON line:', invalidLine)

        // Optionally enqueue error object
        transformController.enqueue({
          level: 'error',
          message: `Parse error: ${invalidLine}`,
          timestamp: Date.now()
        })
      }
    }))
    .pipeThrough(tap((parsed) => {
      console.log('Parsed:', parsed)
    }))

  const reader = parsePipeline.getReader()
  const results: Array<LogMessage> = []

  // Feed JSON Lines data
  controller.enqueue(input)
  controller.close()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    results.push(value)
  }

  return results
}

// Example 3: Bidirectional JSON Lines communication
async function jsonLinesCommunication() {
  const [requestStream, requestController] = createReadable<{ method: string; params: unknown }>()
  const [responseStream, responseController] = createReadable<string>()

  // Encode requests to JSON Lines
  const encodePipeline = requestStream
    .pipeThrough(toJSONLines())

  // Decode responses from JSON Lines
  const decodePipeline = responseStream
    .pipeThrough(fromJSONLines<{ result: unknown; error?: string }>())

  // Send requests
  requestController.enqueue({ method: 'getUser', params: { id: 123 } })
  requestController.enqueue({ method: 'updateSettings', params: { theme: 'dark' } })
  requestController.close()

  // Simulate receiving responses
  responseController.enqueue('{"result":{"name":"Alice"}}\n')
  responseController.enqueue('{"result":{"updated":true}}\n')
  responseController.close()

  // Process encoded requests
  const requestReader = encodePipeline.getReader()
  console.log('Requests:')
  while (true) {
    const { done, value } = await requestReader.read()
    if (done) break
    console.log('  ->', value.trim())
  }

  // Process decoded responses
  const responseReader = decodePipeline.getReader()
  console.log('Responses:')
  while (true) {
    const { done, value } = await responseReader.read()
    if (done) break
    console.log('  <-', value)
  }
}

// Run examples
async function main() {
  console.log('=== Writing JSON Lines ===')
  const output = await writeJSONLines()
  console.log('Output:\n', output)

  console.log('\n=== Reading JSON Lines ===')
  const parsed = await readJSONLines(output)
  console.log('Parsed count:', parsed.length)

  console.log('\n=== Bidirectional Communication ===')
  await jsonLinesCommunication()
}

main().catch(console.error)
```

**Key points:**
- `toJSONLines()` serializes objects to newline-delimited JSON
- `fromJSONLines()` deserializes with buffering across chunks
- Handle invalid JSON with `onInvalidJSON` callback
- Compatible with Unix pipes, sockets, and files
- Automatically handles partial chunks and newline buffering
- Perfect for IPC and streaming APIs

### Step 5: Implement Advanced Stream Patterns

Build complex streaming patterns for real-world scenarios.

```typescript
// pipeline/advanced.ts
import { createReadable, map, tap, transform, createArraySink } from '@enkaku/stream'
import { EventEmitter } from '@enkaku/event'
import { ScheduledTimeout } from '@enkaku/async'

// Pattern 1: Batching Stream
function createBatchTransform<T>(batchSize: number, flushInterval: number) {
  let batch: Array<T> = []
  let timeoutId: NodeJS.Timeout | null = null

  return transform<T, Array<T>>(
    (chunk, controller) => {
      batch.push(chunk)

      // Flush when batch is full
      if (batch.length >= batchSize) {
        controller.enqueue([...batch])
        batch = []

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      } else if (!timeoutId) {
        // Set timeout to flush partial batch
        timeoutId = setTimeout(() => {
          if (batch.length > 0) {
            controller.enqueue([...batch])
            batch = []
          }
          timeoutId = null
        }, flushInterval)
      }
    },
    (controller) => {
      // Flush remaining items
      if (batch.length > 0) {
        controller.enqueue([...batch])
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  )
}

// Pattern 2: Rate Limiting Stream
function createRateLimitTransform<T>(itemsPerSecond: number) {
  const delayMs = 1000 / itemsPerSecond
  let lastEmit = 0

  return transform<T, T>(
    async (chunk, controller) => {
      const now = Date.now()
      const timeSinceLastEmit = now - lastEmit

      if (timeSinceLastEmit < delayMs) {
        await new Promise(resolve => setTimeout(resolve, delayMs - timeSinceLastEmit))
      }

      controller.enqueue(chunk)
      lastEmit = Date.now()
    }
  )
}

// Pattern 3: Deduplication Stream
function createDedupeTransform<T>(keyFn: (item: T) => string, windowMs: number) {
  const seen = new Map<string, number>()

  return transform<T, T>(
    (chunk, controller) => {
      const key = keyFn(chunk)
      const now = Date.now()
      const lastSeen = seen.get(key)

      // Clean up old entries
      for (const [k, timestamp] of seen.entries()) {
        if (now - timestamp > windowMs) {
          seen.delete(k)
        }
      }

      if (!lastSeen || now - lastSeen > windowMs) {
        seen.set(key, now)
        controller.enqueue(chunk)
      }
    }
  )
}

// Pattern 4: Event-Driven Stream
type SensorReading = {
  sensorId: string
  temperature: number
  timestamp: number
}

async function createEventDrivenStream() {
  const events = new EventEmitter<{ reading: SensorReading }>()

  // Convert events to stream with abort control
  using timeout = ScheduledTimeout.in(5000) // 5 second window

  const readingStream = events
    .readable('reading', {
      signal: timeout.signal,
      filter: (reading) => reading.temperature > 20 // Only high temps
    })
    .pipeThrough(map((reading) => ({
      ...reading,
      fahrenheit: (reading.temperature * 9/5) + 32
    })))

  // Collect results
  const [sink, results] = createArraySink<SensorReading & { fahrenheit: number }>()
  readingStream.pipeTo(sink)

  // Emit events
  await events.emit('reading', { sensorId: 'S1', temperature: 25, timestamp: Date.now() })
  await events.emit('reading', { sensorId: 'S2', temperature: 18, timestamp: Date.now() }) // Filtered
  await events.emit('reading', { sensorId: 'S3', temperature: 30, timestamp: Date.now() })

  return results
}

// Pattern 5: Multi-Stage Processing Pipeline
type RawData = { value: string }
type Parsed = { value: number }
type Validated = Parsed & { valid: boolean }
type Enriched = Validated & { category: string }

async function multiStagePipeline() {
  const [source, controller] = createReadable<RawData>()

  const pipeline = source
    // Stage 1: Parse
    .pipeThrough(map<RawData, Parsed>((raw) => ({
      value: Number.parseFloat(raw.value)
    })))
    // Stage 2: Validate
    .pipeThrough(map<Parsed, Validated>((parsed) => ({
      ...parsed,
      valid: !Number.isNaN(parsed.value) && parsed.value >= 0
    })))
    // Stage 3: Filter invalid
    .pipeThrough(transform<Validated, Validated>(
      (chunk, controller) => {
        if (chunk.valid) {
          controller.enqueue(chunk)
        }
      }
    ))
    // Stage 4: Enrich
    .pipeThrough(map<Validated, Enriched>((validated) => ({
      ...validated,
      category: validated.value < 50 ? 'low' : validated.value < 100 ? 'medium' : 'high'
    })))
    // Stage 5: Batch
    .pipeThrough(createBatchTransform(3, 1000))
    // Stage 6: Rate limit
    .pipeThrough(createRateLimitTransform(2))

  // Collect results
  const [sink, results] = createArraySink<Array<Enriched>>()
  pipeline.pipeTo(sink)

  // Feed data
  controller.enqueue({ value: '10' })
  controller.enqueue({ value: '60' })
  controller.enqueue({ value: 'invalid' })
  controller.enqueue({ value: '150' })
  controller.enqueue({ value: '25' })
  controller.enqueue({ value: '80' })
  controller.close()

  return results
}

// Run examples
async function main() {
  console.log('=== Event-Driven Stream ===')
  const eventResults = await createEventDrivenStream()
  console.log('High temperature readings:', await eventResults)

  console.log('\n=== Multi-Stage Pipeline ===')
  const pipelineResults = await multiStagePipeline()
  console.log('Batched results:', await pipelineResults)
}

main().catch(console.error)
```

**Key points:**
- Batching reduces downstream processing overhead
- Rate limiting prevents overwhelming consumers
- Deduplication eliminates redundant data
- Event streams integrate with EventEmitter
- Compose multiple patterns for complex workflows
- Use `createArraySink()` for testing and collection
- Flush functions ensure no data loss

## Complete Example

Here's a complete log processing system with all patterns combined:

```typescript
// example.ts - Complete streaming data handler
import { createReadable, map, mapAsync, tap, toJSONLines, transform } from '@enkaku/stream'

type RawLog = { timestamp: number; level: string; message: string; userId?: string }
type ParsedLog = { timestamp: Date; level: string; message: string; userId?: string }
type EnrichedLog = ParsedLog & { userName?: string }

// Simulate async user lookup
async function lookupUser(userId: string): Promise<string> {
  await new Promise(r => setTimeout(r, 50))
  return `User_${userId}`
}

async function main() {
  const [source, controller] = createReadable<RawLog>()

  // Build complete pipeline
  const pipeline = source
    // 1. Log input
    .pipeThrough(tap(log => console.log('Input:', log)))
    // 2. Parse timestamps
    .pipeThrough(map<RawLog, ParsedLog>(log => ({
      ...log,
      timestamp: new Date(log.timestamp)
    })))
    // 3. Enrich with user data
    .pipeThrough(mapAsync<ParsedLog, EnrichedLog>(async log => {
      if (log.userId) {
        const userName = await lookupUser(log.userId)
        return { ...log, userName }
      }
      return log
    }))
    // 4. Filter errors only
    .pipeThrough(transform<EnrichedLog, EnrichedLog>(
      (log, controller) => {
        if (log.level === 'error') {
          controller.enqueue(log)
        }
      }
    ))
    // 5. Convert to JSON Lines
    .pipeThrough(toJSONLines())

  // Consume output
  const reader = pipeline.getReader()

  // Feed logs
  controller.enqueue({ timestamp: Date.now(), level: 'info', message: 'Started' })
  controller.enqueue({ timestamp: Date.now(), level: 'error', message: 'Failed', userId: '123' })
  controller.enqueue({ timestamp: Date.now(), level: 'error', message: 'Timeout', userId: '456' })
  controller.close()

  // Read results
  console.log('\nOutput (JSON Lines):')
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    console.log(value.trim())
  }
}

main().catch(console.error)
```

Run with:
```bash
bun example.ts
```

Expected output:
```
Input: { timestamp: 1234567890, level: 'info', message: 'Started' }
Input: { timestamp: 1234567891, level: 'error', message: 'Failed', userId: '123' }
Input: { timestamp: 1234567892, level: 'error', message: 'Timeout', userId: '456' }

Output (JSON Lines):
{"timestamp":"2024-01-10T12:34:50.000Z","level":"error","message":"Failed","userId":"123","userName":"User_123"}
{"timestamp":"2024-01-10T12:34:51.000Z","level":"error","message":"Timeout","userId":"456","userName":"User_456"}
```

## Extending This Example

### How to Handle Stream Cancellation

Add proper cleanup with AbortSignal:

```typescript
import { Disposer } from '@enkaku/async'

async function processWithCancellation() {
  const disposer = new Disposer()

  const [source, controller] = createReadable<number>({
    cancel: async () => {
      console.log('Stream cancelled')
      await disposer.dispose()
    }
  })

  const pipeline = source.pipeThrough(
    mapAsync(async (n) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return n * 2
    })
  )

  const reader = pipeline.getReader()

  // Process with timeout
  using timeout = ScheduledTimeout.in(500)

  try {
    while (true) {
      if (timeout.signal.aborted) {
        await reader.cancel()
        break
      }

      const { done, value } = await reader.read()
      if (done) break
      console.log(value)
    }
  } finally {
    reader.releaseLock()
  }
}
```

### How to Implement Stream Merging

Combine multiple streams into one:

```typescript
async function mergeStreams<T>(...streams: Array<ReadableStream<T>>): Promise<ReadableStream<T>> {
  return new ReadableStream<T>({
    async start(controller) {
      const readers = streams.map(s => s.getReader())

      await Promise.all(
        readers.map(async (reader) => {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        })
      )

      controller.close()
    }
  })
}

// Usage
const [stream1, controller1] = createReadable<number>()
const [stream2, controller2] = createReadable<number>()

const merged = await mergeStreams(stream1, stream2)
```

### How to Add Progress Tracking

Monitor stream processing progress:

```typescript
function createProgressTransform<T>(
  onProgress: (processed: number, total: number) => void,
  total: number
) {
  let processed = 0

  return transform<T, T>(
    (chunk, controller) => {
      processed++
      onProgress(processed, total)
      controller.enqueue(chunk)
    },
    (controller) => {
      console.log(`Completed: ${processed}/${total}`)
    }
  )
}

// Usage
const pipeline = source
  .pipeThrough(createProgressTransform(
    (processed, total) => {
      console.log(`Progress: ${((processed / total) * 100).toFixed(1)}%`)
    },
    1000
  ))
```

## Related Capabilities

### Domain Documentation
- [Streaming & Data Flow](../domains/streaming.md) - Complete reference for stream processing, async utilities, and event handling

### Related Use Cases
- [Real-Time Communication](real-time-communication.md) - Using streams in RPC contexts with bidirectional channels
- [Building an RPC Server](building-rpc-server.md) - Integrating streams with RPC protocols

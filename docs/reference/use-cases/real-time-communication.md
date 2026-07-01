# Real-Time Communication

## Goal

Learn how to build real-time, bidirectional communication systems with Enkaku by creating a live dashboard that streams server metrics, receives commands, and provides instant updates. You'll use streams for server-to-client data flow, channels for bidirectional communication, and socket transport for persistent connections with minimal overhead.

## Prerequisites

Install the required packages:

```bash
pnpm add @enkaku/protocol @enkaku/server @enkaku/socket-transport
pnpm add @enkaku/client  # For client implementation
```

## Step-by-Step Implementation

### Step 1: Define Real-Time Protocol

Create a protocol that includes streaming procedures for live data and bidirectional channels for interactive communication.

```typescript
// shared/protocol.ts
import type { ProtocolDefinition } from '@enkaku/protocol'

export const dashboardProtocol = {
  // Stream: Server pushes metrics to client continuously
  'metrics/stream': {
    type: 'stream',
    param: {
      type: 'object',
      properties: {
        interval: { type: 'number' }  // Update interval in ms
      },
      required: ['interval'],
      additionalProperties: false
    },
    receive: {
      type: 'object',
      properties: {
        cpu: { type: 'number' },
        memory: { type: 'number' },
        timestamp: { type: 'number' }
      },
      required: ['cpu', 'memory', 'timestamp'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        totalSamples: { type: 'number' }
      },
      required: ['totalSamples'],
      additionalProperties: false
    }
  },

  // Channel: Bidirectional log streaming with filtering
  'logs/watch': {
    type: 'channel',
    param: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error']
        }
      },
      required: ['level'],
      additionalProperties: false
    },
    // Client can send filter updates
    send: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error']
        }
      },
      required: ['level'],
      additionalProperties: false
    },
    // Server sends matching log entries
    receive: {
      type: 'object',
      properties: {
        level: { type: 'string' },
        message: { type: 'string' },
        timestamp: { type: 'number' }
      },
      required: ['level', 'message', 'timestamp'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        totalLogs: { type: 'number' }
      },
      required: ['totalLogs'],
      additionalProperties: false
    }
  },

  // Request: Traditional request-response for commands
  'system/restart': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        service: { type: 'string' }
      },
      required: ['service'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      },
      required: ['success', 'message'],
      additionalProperties: false
    }
  }
} as const satisfies ProtocolDefinition

export type DashboardProtocol = typeof dashboardProtocol
```

**Key points:**
- `stream` type: Server sends data continuously, returns result when complete
- `channel` type: Bidirectional - both client and server can send messages
- `param`: Initial parameters when opening stream/channel
- `receive`: Type of data client receives from server
- `send`: Type of data client sends to server (channels only)
- `result`: Final value returned when stream/channel closes

### Step 2: Implement Streaming Handler

Create a handler that continuously sends live metrics to connected clients.

```typescript
// server/handlers/metrics.ts
import type { StreamHandler } from '@enkaku/server'
import type { DashboardProtocol } from '../../shared/protocol'
import os from 'node:os'

export const metricsStreamHandler: StreamHandler<
  DashboardProtocol,
  'metrics/stream'
> = async ({ param, writable, signal }) => {
  const writer = writable.getWriter()
  let sampleCount = 0

  // Create interval for sending metrics
  const intervalId = setInterval(async () => {
    try {
      const cpuUsage = os.loadavg()[0] / os.cpus().length * 100
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const memoryUsage = ((totalMem - freeMem) / totalMem) * 100

      await writer.write({
        cpu: Math.round(cpuUsage * 100) / 100,
        memory: Math.round(memoryUsage * 100) / 100,
        timestamp: Date.now()
      })

      sampleCount++
    } catch (error) {
      console.error('Failed to send metric:', error)
    }
  }, param.interval)

  // Clean up on abort (client disconnect)
  signal.addEventListener('abort', () => {
    clearInterval(intervalId)
    writer.close()
  })

  // Wait for abort signal
  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve())
  })

  // Return result when stream ends
  return { totalSamples: sampleCount }
}
```

**Key points:**
- `writable` is a WritableStream for sending data to client
- Use `getWriter()` to get a writer for the stream
- `signal` is an AbortSignal that fires when client disconnects
- Always clean up resources (intervals, connections) on abort
- Return value becomes the final `result` message
- Use `try/catch` around writes to handle backpressure

### Step 3: Implement Channel Handler

Create a bidirectional handler that filters logs based on client requests.

```typescript
// server/handlers/logs.ts
import type { ChannelHandler } from '@enkaku/server'
import type { DashboardProtocol } from '../../shared/protocol'
import { EventEmitter } from 'node:events'

// Simulated log system
const logEmitter = new EventEmitter()

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogEntry = {
  level: LogLevel
  message: string
  timestamp: number
}

// Simulate log generation
setInterval(() => {
  const levels: Array<LogLevel> = ['debug', 'info', 'warn', 'error']
  const level = levels[Math.floor(Math.random() * levels.length)]

  logEmitter.emit('log', {
    level,
    message: `${level.toUpperCase()}: Sample log message`,
    timestamp: Date.now()
  })
}, 500)

export const logsWatchHandler: ChannelHandler<
  DashboardProtocol,
  'logs/watch'
> = async ({ param, readable, writable, signal }) => {
  const writer = writable.getWriter()
  const reader = readable.getReader()
  let currentLevel = param.level
  let totalLogs = 0

  // Handle incoming filter updates from client
  const readUpdates = async () => {
    while (!signal.aborted) {
      try {
        const { done, value } = await reader.read()
        if (done) break

        // Client sent new filter level
        currentLevel = value.level
        console.log(`Filter updated to: ${currentLevel}`)
      } catch (error) {
        if (!signal.aborted) {
          console.error('Error reading filter update:', error)
        }
        break
      }
    }
  }

  // Send logs that match current filter
  const logHandler = (log: LogEntry) => {
    if (signal.aborted) return

    const levels: Array<LogLevel> = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(currentLevel)
    const logLevelIndex = levels.indexOf(log.level)

    // Only send if log level >= current filter level
    if (logLevelIndex >= currentLevelIndex) {
      writer.write(log).catch((error) => {
        console.error('Failed to write log:', error)
      })
      totalLogs++
    }
  }

  logEmitter.on('log', logHandler)

  // Clean up on disconnect
  signal.addEventListener('abort', () => {
    logEmitter.off('log', logHandler)
    writer.close()
  })

  // Start reading filter updates concurrently
  readUpdates()

  // Wait for abort
  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve())
  })

  return { totalLogs }
}
```

**Key points:**
- Channels have both `readable` (client → server) and `writable` (server → client)
- Read from `readable` to receive messages from client
- Write to `writable` to send messages to client
- Handle both streams concurrently using async operations
- Update handler behavior based on client messages
- Clean up all listeners on abort

### Step 4: Implement Request Handler

Create a traditional request handler for one-off commands.

```typescript
// server/handlers/system.ts
import type { RequestHandler } from '@enkaku/server'
import type { DashboardProtocol } from '../../shared/protocol'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export const systemRestartHandler: RequestHandler<
  DashboardProtocol,
  'system/restart'
> = async ({ param }) => {
  try {
    console.log(`Restarting service: ${param.service}`)

    // In production, use proper service management
    // await execAsync(`systemctl restart ${param.service}`)

    // For demo purposes, simulate restart
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      success: true,
      message: `Service ${param.service} restarted successfully`
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

### Step 5: Set Up Socket Transport Server

Use Unix socket or TCP socket for persistent, low-latency connections.

```typescript
// server/index.ts
import { createServer } from 'node:net'
import { Server } from '@enkaku/server'
import { SocketTransport } from '@enkaku/socket-transport'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { dashboardProtocol } from '../shared/protocol'
import { metricsStreamHandler } from './handlers/metrics'
import { logsWatchHandler } from './handlers/logs'
import { systemRestartHandler } from './handlers/system'

const SOCKET_PATH = '/tmp/dashboard.sock'

// Clean up stale socket
import { existsSync, unlinkSync } from 'node:fs'
if (existsSync(SOCKET_PATH)) {
  unlinkSync(SOCKET_PATH)
}

const netServer = createServer((socket) => {
  console.log('Client connected')

  // Create transport for this connection
  const transport = new SocketTransport<
    AnyClientMessageOf<typeof dashboardProtocol>,
    AnyServerMessageOf<typeof dashboardProtocol>
  >({ socket })

  // Create RPC server for this client
  const server = new Server({
    protocol: dashboardProtocol,
    transport,
    handlers: {
      'metrics/stream': metricsStreamHandler,
      'logs/watch': logsWatchHandler,
      'system/restart': systemRestartHandler
    },
    public: true  // No authentication for demo
  })

  // Clean up on disconnect
  socket.on('close', async () => {
    console.log('Client disconnected')
    await transport.dispose()
    await server.dispose()
  })

  socket.on('error', (error) => {
    console.error('Socket error:', error)
  })
})

netServer.listen(SOCKET_PATH, () => {
  console.log(`Dashboard server listening on ${SOCKET_PATH}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  netServer.close()
  process.exit(0)
})
```

**Key points:**
- Each socket connection gets its own transport and server instance
- Clean up stale socket files before listening
- Each client has isolated state and handlers
- Use Unix sockets for same-host communication (faster than TCP)
- For network access, use TCP: `netServer.listen(3000, '0.0.0.0')`

### Step 6: Create Client

Build a client that subscribes to streams and interacts via channels.

```typescript
// client/index.ts
import { Client } from '@enkaku/client'
import { SocketTransport } from '@enkaku/socket-transport'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { dashboardProtocol } from '../shared/protocol'

const SOCKET_PATH = '/tmp/dashboard.sock'

async function main() {
  // Connect to server
  const transport = new SocketTransport<
    AnyServerMessageOf<typeof dashboardProtocol>,
    AnyClientMessageOf<typeof dashboardProtocol>
  >({ socket: SOCKET_PATH })

  const client = new Client({ transport })

  try {
    // Start metrics stream
    console.log('Starting metrics stream...')
    const metricsStream = client.stream('metrics/stream', {
      param: { interval: 2000 }  // Every 2 seconds
    })

    // Read metrics in background
    const readMetrics = async () => {
      try {
        for await (const metric of metricsStream.readable) {
          console.log(
            `[${new Date(metric.timestamp).toLocaleTimeString()}] ` +
            `CPU: ${metric.cpu.toFixed(2)}% | Memory: ${metric.memory.toFixed(2)}%`
          )
        }
        const result = await metricsStream
        console.log(`Metrics stream ended. Total samples: ${result.totalSamples}`)
      } catch (error) {
        console.error('Metrics stream error:', error)
      }
    }

    // Start watching logs
    console.log('Starting log watch channel...')
    const logsChannel = client.channel('logs/watch', {
      param: { level: 'info' }  // Start with info level
    })

    // Read logs in background
    const readLogs = async () => {
      try {
        for await (const log of logsChannel.readable) {
          const emoji = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌'
          }[log.level]

          console.log(
            `${emoji} [${log.level.toUpperCase()}] ${log.message}`
          )
        }
        const result = await logsChannel
        console.log(`Log channel ended. Total logs: ${result.totalLogs}`)
      } catch (error) {
        console.error('Log channel error:', error)
      }
    }

    // Start both readers
    readMetrics()
    readLogs()

    // After 5 seconds, change log filter to 'error' only
    setTimeout(async () => {
      console.log('\n📝 Changing log filter to ERROR level...\n')
      const writer = logsChannel.writable.getWriter()
      await writer.write({ level: 'error' })
      writer.releaseLock()
    }, 5000)

    // After 10 seconds, restart a service
    setTimeout(async () => {
      console.log('\n🔄 Restarting web service...\n')
      const result = await client.request('system/restart', {
        param: { service: 'web' }
      })
      console.log(
        result.success
          ? `✅ ${result.message}`
          : `❌ ${result.message}`
      )
    }, 10000)

    // Run for 15 seconds then disconnect
    await new Promise(resolve => setTimeout(resolve, 15000))

    console.log('\n👋 Disconnecting...')
    await client.dispose()

  } catch (error) {
    console.error('Client error:', error)
  }
}

main().catch(console.error)
```

**Key points:**
- Call `stream()` to create a stream subscription
- Call `channel()` to create a bidirectional channel
- Use `for await` to read from `readable` stream
- Write to `writable` to send messages to server
- The stream/channel promise resolves to the final `result`
- Always dispose client to clean up connections

## Complete Example

Here's a minimal example showing real-time communication:

```typescript
// example.ts - Complete streaming example
import { createServer } from 'node:net'
import { Client } from '@enkaku/client'
import { SocketTransport } from '@enkaku/socket-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { Server } from '@enkaku/server'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'

// 1. Define protocol with streaming
const protocol = {
  'counter': {
    type: 'stream',
    param: {
      type: 'object',
      properties: { max: { type: 'number' } },
      required: ['max']
    },
    receive: {
      type: 'object',
      properties: { count: { type: 'number' } },
      required: ['count']
    },
    result: {
      type: 'object',
      properties: { total: { type: 'number' } },
      required: ['total']
    }
  }
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol
const SOCKET_PATH = '/tmp/counter.sock'

// 2. Start server
import { existsSync, unlinkSync } from 'node:fs'
if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH)

const netServer = createServer((socket) => {
  const transport = new SocketTransport<
    AnyClientMessageOf<Protocol>,
    AnyServerMessageOf<Protocol>
  >({ socket })

  new Server({
    protocol,
    transport,
    public: true,
    handlers: {
      counter: async ({ param, writable, signal }) => {
        const writer = writable.getWriter()

        for (let count = 1; count <= param.max; count++) {
          if (signal.aborted) break
          await writer.write({ count })
          await new Promise(r => setTimeout(r, 1000))
        }

        return { total: param.max }
      }
    }
  })
})

netServer.listen(SOCKET_PATH, async () => {
  console.log('Server running')

  // 3. Create client
  const transport = new SocketTransport<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >({ socket: SOCKET_PATH })

  const client = new Client({ transport })

  // 4. Subscribe to stream
  const stream = client.stream('counter', { param: { max: 5 } })

  for await (const message of stream.readable) {
    console.log(`Count: ${message.count}`)
  }

  const result = await stream
  console.log(`Total: ${result.total}`)

  // 5. Cleanup
  await client.dispose()
  netServer.close()
})
```

Run with:
```bash
bun example.ts
```

Output:
```
Server running
Count: 1
Count: 2
Count: 3
Count: 4
Count: 5
Total: 5
```

## Extending This Example

### How to Add Connection Lifecycle Events

Monitor connections and handle reconnection:

```typescript
import { EventEmitter } from '@enkaku/event'

type ConnectionEvents = {
  connected: { clientId: string }
  disconnected: { clientId: string; reason: string }
}

const connections = new EventEmitter<ConnectionEvents>()

// Server: Track connections
netServer.on('connection', (socket) => {
  const clientId = crypto.randomUUID()
  connections.emit('connected', { clientId })

  socket.on('close', () => {
    connections.emit('disconnected', {
      clientId,
      reason: 'client closed'
    })
  })
})

// Monitor connection events
connections.on('connected', ({ clientId }) => {
  console.log(`Client ${clientId} connected`)
})

connections.on('disconnected', ({ clientId, reason }) => {
  console.log(`Client ${clientId} disconnected: ${reason}`)
})
```

### How to Add Backpressure Handling

Handle slow clients gracefully:

```typescript
// Server handler with backpressure
'metrics/stream': async ({ param, writable, signal }) => {
  const writer = writable.getWriter()

  const sendMetric = async () => {
    const metric = collectMetrics()

    try {
      // Wait for write to complete (respects backpressure)
      await writer.write(metric)
    } catch (error) {
      console.error('Write failed (client may be slow):', error)
      // Optionally skip this metric or slow down
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  const intervalId = setInterval(sendMetric, param.interval)

  signal.addEventListener('abort', () => {
    clearInterval(intervalId)
  })

  await new Promise(r => signal.addEventListener('abort', r))
  return { totalSamples: 0 }
}
```

### How to Use HTTP with Server-Sent Events

Use HTTP transport for browser clients:

```typescript
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport } from '@enkaku/http-server-transport'

// Server
const httpTransport = new ServerTransport<Protocol>({
  allowedOrigin: ['https://example.com']
})

Bun.serve({
  port: 3000,
  fetch: httpTransport.fetch
})

// Browser client
const clientTransport = new ClientTransport<Protocol>({
  url: 'https://api.example.com/rpc'
})

const client = new Client({ transport: clientTransport })

// Same API - streams use SSE under the hood
const stream = client.stream('metrics/stream', { param: { interval: 2000 } })
for await (const metric of stream.readable) {
  updateDashboard(metric)
}
```

### How to Broadcast to Multiple Clients

Share streams across all connected clients:

```typescript
import { EventEmitter } from '@enkaku/event'

type MetricUpdate = { cpu: number; memory: number; timestamp: number }

const metricBroadcaster = new EventEmitter<{ metric: MetricUpdate }>()

// Collect metrics once
setInterval(() => {
  const metric = {
    cpu: getCPU(),
    memory: getMemory(),
    timestamp: Date.now()
  }
  metricBroadcaster.emit('metric', metric)
}, 1000)

// Each client subscribes to broadcaster
'metrics/stream': async ({ writable, signal }) => {
  const writer = writable.getWriter()

  const handler = (metric: MetricUpdate) => {
    writer.write(metric).catch(console.error)
  }

  metricBroadcaster.on('metric', handler)

  signal.addEventListener('abort', () => {
    metricBroadcaster.off('metric', handler)
  })

  await new Promise(r => signal.addEventListener('abort', r))
  return { totalSamples: 0 }
}
```

## Related Capabilities

### Domain Documentation
- [Transport](../domains/transport.md) - Complete transport layer reference including sockets, HTTP, and message transports
- [Streaming](../domains/streaming.md) - Stream processing, async utilities, and data flow patterns
- [Core RPC](../domains/core-rpc.md) - Protocol definitions, client/server architecture, and type safety

### Related Use Cases
- [Building an RPC Server](building-rpc-server.md) - Basic request-response patterns and HTTP transport

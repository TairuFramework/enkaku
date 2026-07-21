# Architecture

Technical architecture and design patterns for the Enkaku RPC framework.

---

## What is Enkaku?

Enkaku is a modern, type-safe RPC framework for TypeScript applications. It provides protocol-driven client-server communication with strong typing, multiple transport options (HTTP, TCP/Unix sockets, Node.js streams, MessagePort, Electron IPC), and schema-validated runtime safety. The framework is a pnpm-workspaces monorepo of modular packages that can be used independently or together.

Enkaku is the RPC layer of the five-repo Yulsi stack. Cross-cutting primitives it depends on come from sibling repos: build/tooling from `@kigu/*`, runtime/async/schema/transport utilities from `@sozai/*`, and identity/auth (tokens, capabilities, keystores) from `@kokuin/*`. Group/MLS and hub messaging now live downstream in `@kumiai/*` (formerly in-repo, moved out in the 0.18 stack refactor). Enkaku itself ships RPC core, transports, OTel naming, and React bindings only.

---

## Core Concepts

**RPC (Remote Procedure Calls)**: Enkaku enables type-safe procedure calls between client and server with full TypeScript inference. Protocol definitions drive automatic type generation for both sides.

**Four procedure types**: request (single response), event (fire-and-forget), stream (server-to-client data flow), channel (bidirectional communication).

**Transport Layer**: Multiple transport mechanisms (HTTP, TCP/Unix sockets, Node.js streams, MessagePort, Electron IPC). Transport implementations are modular and swappable without changing application code. There is no WebSocket transport -- bidirectional flows run over SSE-backed HTTP channels, sockets, or MessagePort.

**Authentication (external)**: Enkaku's server enforces access control and encryption policy at the procedure level, but the token/keystore/capability implementations live in `@kokuin/*` (`@kokuin/token`, `@kokuin/capability`). Enkaku consumes them; it no longer ships them.

**Type Safety**: Heavy use of TypeScript generics ensures end-to-end type safety from protocol definitions through client calls to server handlers. Schema validation (`@sozai/schema`, JSON Schema) provides runtime safety.

---

## RPC Framework Patterns

### Protocol Definitions
- Define protocols using `type` with procedure type definitions
- Use `RequestProcedureDefinition`, `EventProcedureDefinition`, `StreamProcedureDefinition`, `ChannelProcedureDefinition`
- Include proper parameter and return type definitions
- Use schema validation for runtime type checking

### Client Implementation
- Create typed clients using protocol definitions
- Implement request/response, streaming, and channel patterns
- Use abort controllers for cancellation
- Return promises with additional metadata (id, abort, signal)

### Server Implementation
- Register handlers using protocol procedure names
- Implement proper error handling and propagation
- Use execution chains for middleware-like functionality
- Support access control and authentication (via `@kokuin/*` identities)

### Transport Layer
- Create transport abstractions for different communication methods
- Implement bidirectional communication patterns
- Handle connection lifecycle (connect, disconnect, error)
- Support message serialization/deserialization

### Streaming Patterns
- Implement readable/writable stream interfaces
- Use async iterators for consuming streams
- Handle backpressure and flow control
- Support stream transformation and piping

### Connection Management
- Handle connection state changes gracefully
- Implement reconnection logic where appropriate
- Use disposers for cleanup and resource management
- Support connection pooling for HTTP transports

---

## Architecture Overview

### Core Structure
- **Monorepo**: pnpm workspaces with packages in `packages/`, tests in `tests/`, docs site in `website/`
- **Tooling**: `@kigu/dev` provides shared biome/tsconfig/swc config; root `biome.json` and package tsconfigs extend it
- **Build System**: Turbo for build orchestration, SWC for compilation (`esnext` target)
- **Testing**: Vitest test runner (`test:types` + `test:unit` via Turbo)
- **Linting**: Biome for code formatting and linting
- **Versioning**: Changesets

### Package Structure
All packages follow this standard layout:
```
packages/[package-name]/
├── src/
│   ├── index.ts          # Main entry point (barrel exports)
│   └── [implementation]  # Implementation files
├── lib/                  # Build output (gitignored)
├── test/                 # Test files (.test.ts)
├── package.json
├── tsconfig.json
└── README.md
```

### Key Packages (13)

#### Core RPC
- **protocol** (`@enkaku/protocol`): Core protocol definitions, schemas, and types
- **client** (`@enkaku/client`): Client-side RPC implementation with typed procedure calls
- **server** (`@enkaku/server`): Server-side RPC with handler registration, access control, and `HandlerError`
- **standalone** (`@enkaku/standalone`): Combined client and server for in-process RPC (no transport needed)

#### Transport
- **transport** (`@enkaku/transport`): Generic transport abstraction and interfaces
- **http-fetch** (`@enkaku/http-fetch`): HTTP transport for clients (POST-based sessions, SSE, fetch + eventsource-parser)
- **http-serve** (`@enkaku/http-serve`): HTTP transport for servers (bounded request body, `413` on overflow)
- **socket** (`@enkaku/socket`): TCP/Unix socket transport over `node:net`; connect-only (`SocketTransport`, `connectSocket`) -- servers supply their own accepted sockets
- **node-streams** (`@enkaku/node-streams`): Node.js streams transport
- **message** (`@enkaku/message`): MessagePort transport (web workers, iframes)
- **electron** (`@enkaku/electron`): Electron IPC transport (sender allowlist)

#### Observability
- **otel** (`@enkaku/otel`): OpenTelemetry span/attribute names + W3C Trace Context propagation codecs (`traceparent`/`tracestate`/`baggage`, inbound + outbound)

#### Platform
- **react** (`@enkaku/react`): React bindings for the Enkaku RPC client

### External dependencies (sibling repos)
- `@sozai/*` — `async`, `event`, `execution`, `log`, `otel`, `runtime`, `schema`, `stream`
- `@kokuin/*` — `token`, `capability`
- `@kigu/dev` — shared build/lint/test tooling

---

## Lifecycle events

Each of `Transport`, `Server`, and `Client` exposes an `events` EventEmitter so consumers can observe the full connection lifecycle:

- **`Transport.events`** — `writeFailed` (optional, transport-specific), `readFailed`, `disposing`, `disposed`.
- **`Server.events`** — `handlerError` (discriminated by `category` ∈ {auth, limit, encryption, handler} and `messageType` ∈ {event, request, channel, stream, send}), `handlerTimeout`, `invalidMessage`, `handlerStart`, `handlerEnd`, `handlerAbort`, `writeDropped`, `writeFailed`, `disposing`, `disposed`, `transportAdded`, `transportRemoved`.
- **`Client.events`** — `requestStart`, `requestEnd`, `requestError`, `writeDropped`, `transportError`, `transportReplaced`, `disposing`, `disposed`.

Benign teardown errors (`AbortError`, `DisposeInterruption`, closed-writer/reader) are swallowed by the internal `safeWrite` wrapper and surface as `writeDropped` rather than unhandled rejections. Use `isBenignTeardownError` from `@sozai/async` to classify errors in consumer code.

---

## Available Skills

The progressive discovery system provides focused guidance for specific domains.

### Discovery
- `/enkaku:discover` - Entry point for exploring capabilities by domain or use case

### Domain Skills
- `/enkaku:transport` - HTTP, sockets, streams, custom transports
- `/enkaku:core-rpc` - Protocol, client, server basics

> The former `/enkaku:auth`, `/enkaku:validation`, and `/enkaku:streaming` skills were removed in the 0.18 split — their domains moved to `/kokuin:auth` + `/kokuin:capability` (identity/keystores) and `/sozai:validation` + `/sozai:dataflow` (schema/streaming). See `/enkaku:discover` for the cross-repo map.

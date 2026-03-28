# Architecture

Technical architecture and design patterns for the Enkaku RPC framework.

---

## What is Enkaku?

Enkaku is a modern, type-safe RPC framework for TypeScript applications. It provides a complete solution for building remote procedure call systems with strong typing, multiple transport options (HTTP, WebSocket, streams), authentication, and schema validation. The framework is built as a monorepo with modular packages that can be used independently or together.

---

## Core Concepts

**RPC (Remote Procedure Calls)**: Enkaku enables type-safe procedure calls between client and server with full TypeScript inference. Protocol definitions drive automatic type generation for both sides of the communication.

**Transport Layer**: The framework supports multiple transport mechanisms (HTTP, WebSocket, Node.js streams, MessagePort, Electron IPC). Transport implementations are modular and can be swapped based on application needs.

**Authentication & Security**: Built-in token system provides JWT-like authentication with signing and verification, plus JWE message-level encryption using ECDH-ES key agreement and A256GCM. Keystore abstractions enable secure key management across different environments (Node.js, browser, React Native, Electron). Access control and encryption policy are enforced at the procedure level.

**Capabilities & Delegation**: A capability-based authorization model supports delegation chains — a root identity can delegate scoped permissions to subordinate keys. Revocation is implemented as a `VerifyTokenHook`, plugging into the existing token verification pipeline. The `IdentityProvider<T>` abstraction decouples identity creation from the backing store (software HD keystore, Ledger hardware wallet).

**Hub & Mailbox**: A blind relay hub provides store-and-forward messaging between devices. The hub sees only routing metadata (sender DID, recipient DIDs, opaque payload). Supports explicit recipient sends and group fan-out. Channel-based receive with ack semantics ensures reliable delivery.

**Group Communication (MLS)**: End-to-end encrypted group communication using the MLS protocol (RFC 9420) via the ts-mls library. Groups support up to ~100 members with TreeKEM key management. Enkaku capabilities serve as MLS credentials, bridging the identity system with the group encryption layer.

**Type Safety**: Heavy use of TypeScript generics ensures end-to-end type safety from protocol definitions through client calls to server handlers. Schema validation using JSON Schema and AJV provides runtime safety.

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
- Support access control and authentication

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
- **Monorepo**: Uses pnpm workspaces with packages in `packages/` directory
- **Build System**: Turbo for build orchestration, SWC for compilation
- **Testing**: Vitest test runner
- **Linting**: Biome for code formatting and linting

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

### Key Packages

#### Core RPC
- **protocol**: Core protocol definitions, schemas, and types
- **client**: Client-side RPC implementation with typed procedure calls
- **server**: Server-side RPC implementation with handler registration
- **execution**: Execution chain management for procedures
- **schema**: JSON Schema validation (AJV-based) for runtime type checking
- **codec**: Message serialization and deserialization
- **standalone**: Combined client and server for in-process RPC (no transport needed)

#### Transport
- **transport**: Generic transport abstraction and interfaces
- **http-client-transport**: HTTP transport for clients (POST-based sessions, SSE)
- **http-server-transport**: HTTP transport for servers
- **socket-transport**: WebSocket transport for clients and servers
- **node-streams-transport**: Node.js streams transport
- **message-transport**: MessagePort transport (web workers, iframes)
- **electron-rpc**: Electron IPC transport

#### Auth, Identity & Security
- **token**: JWT signing/verification, JWE encryption (ECDH-ES + A256GCM), `IdentityProvider<T>` abstraction
- **capability**: Capability delegation chains, `RevocationBackend`, `createRevocationChecker` as `VerifyTokenHook`
- **ledger-identity**: Ledger hardware wallet identity provider (APDU client for custom BOLOS app)
- **hd-keystore**: Software HD keystore — BIP39 mnemonic to Ed25519 keys via SLIP-0010

#### Keystores
- **browser-keystore**: Browser keystore (IndexedDB, SubtleCrypto)
- **node-keystore**: Node.js keystore (filesystem)
- **expo-keystore**: React Native keystore
- **electron-keystore**: Electron keystore

#### Hub & Group Communication
- **hub-protocol**: Protocol types for blind relay hub (send, group/send, receive)
- **hub-server**: Hub server with `HubStore` abstraction, fan-out routing, ack-based delivery
- **hub-client**: Hub client wrapper (send, groupSend, receive, group management)
- **group**: E2EE group management using MLS (ts-mls), custom noble CryptoProvider for Hermes compatibility

#### Utilities
- **async**: Async primitives (deferred, semaphore, disposables)
- **event**: Zero-dependency event emitter
- **flow**: Stateful flow execution
- **generator**: Generator utilities
- **stream**: Web streams utilities for transports
- **result**: Option, Result, and AsyncResult primitives
- **patch**: JSON patch utilities
- **log**: Logging wrapper around LogTape (namespaced loggers, console sink)
- **otel**: OpenTelemetry integration (tracer utilities, span helpers, semantic constants, trace context propagation)

#### Platform
- **react**: React bindings for Enkaku RPC client

---

## Available Skills

The progressive discovery system provides focused guidance for specific domains. Skills are being built progressively -- use what's available:

### Discovery
- `/enkaku:discover` - Entry point for exploring capabilities by domain or use case

### Domain Skills
- `/enkaku:transport` - HTTP, WebSocket, streams, custom transports
- `/enkaku:auth` - Tokens, keystores, signing, verification, encryption
- `/enkaku:streaming` - Stream utilities, async patterns, data flow
- `/enkaku:validation` - Schema, codec, type generation
- `/enkaku:core-rpc` - Protocol, client, server basics

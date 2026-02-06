# Architecture

Technical architecture and design patterns for the Enkaku RPC framework.

---

## What is Enkaku?

Enkaku is a modern, type-safe RPC framework for TypeScript applications. It provides a complete solution for building remote procedure call systems with strong typing, multiple transport options (HTTP, WebSocket, streams), authentication, and schema validation. The framework is built as a monorepo with modular packages that can be used independently or together.

---

## Core Concepts

**RPC (Remote Procedure Calls)**: Enkaku enables type-safe procedure calls between client and server with full TypeScript inference. Protocol definitions drive automatic type generation for both sides of the communication.

**Transport Layer**: The framework supports multiple transport mechanisms (HTTP, WebSocket, Node.js streams, custom message-based transports). Transport implementations are modular and can be swapped based on application needs.

**Authentication & Security**: Built-in token system provides JWT-like authentication with signing and verification, plus JWE message-level encryption using ECDH-ES key agreement and A256GCM. Keystore abstractions enable secure key management across different environments (Node.js, browser, React Native, Electron). Access control and encryption policy are enforced at the procedure level.

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
- **protocol**: Core protocol definitions, schemas, and types
- **client**: Client-side RPC implementation with typed procedure calls
- **server**: Server-side RPC implementation with handler registration
- **transport**: Transport layer abstractions (http, socket, node-streams)
- **token**: JWT-like token system for authentication and JWE message encryption
- **stream**: Stream utilities for data flow management
- **execution**: Execution chain management for procedures
- **keystore**: Key management for different environments (node, browser, expo)

---

## Available Skills

The progressive discovery system provides focused guidance for specific domains. Skills are being built progressively -- use what's available:

### Discovery
- `/enkaku:discover` - Entry point for exploring capabilities by domain or use case

### Domain Skills
- `/enkaku:transport` - HTTP, WebSocket, streams, custom transports
- `/enkaku:auth` - Tokens, keystores, signing, verification
- `/enkaku:streaming` - Stream utilities, async patterns, data flow
- `/enkaku:validation` - Schema, codec, type generation
- `/enkaku:execution` - Execution chains, middleware, capabilities
- `/enkaku:core-rpc` - Protocol, client, server basics
- `/enkaku:utilities` - Result types, patches, generator

### Platform (Optional)
- `/enkaku:platform` - React, Electron integrations

**Note**: This discovery system is under active development. If a skill isn't available yet, explore the codebase directly or ask for guidance.

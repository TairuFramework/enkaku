# AGENTS.md

This file provides guidance for AI agents working with the Enkaku codebase.

## What is Enkaku?

Enkaku is a modern, type-safe RPC framework for TypeScript applications. It provides a complete solution for building remote procedure call systems with strong typing, multiple transport options (HTTP, WebSocket, streams), authentication, and schema validation. The framework is built as a monorepo with modular packages that can be used independently or together.

## Quick Start for Agents

**Before exploring code**, use the progressive discovery system to understand Enkaku's capabilities:

```
/enkaku:discover
```

This skill guides you through available domains and use cases, helping you find the right packages and patterns for your task without loading unnecessary context upfront.

## Core Concepts

**RPC (Remote Procedure Calls)**: Enkaku enables type-safe procedure calls between client and server with full TypeScript inference. Protocol definitions drive automatic type generation for both sides of the communication.

**Transport Layer**: The framework supports multiple transport mechanisms (HTTP, WebSocket, Node.js streams, custom message-based transports). Transport implementations are modular and can be swapped based on application needs.

**Authentication & Security**: Built-in token system provides JWT-like authentication with signing and verification. Keystore abstractions enable secure key management across different environments (Node.js, browser, React Native). Access control is enforced at the procedure level.

**Type Safety**: Heavy use of TypeScript generics ensures end-to-end type safety from protocol definitions through client calls to server handlers. Schema validation using JSON Schema and AJV provides runtime safety.

## Available Skills

The progressive discovery system provides focused guidance for specific domains. Skills are being built progressively - use what's available:

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

## Commands

### Build
- `pnpm run build` - Build types and JavaScript files
- `pnpm run build:types` - Build TypeScript declarations only
- `pnpm run build:js` - Build JavaScript files only (using turbo)

### Testing
- `pnpm run test` - Run all tests (TypeScript checks + unit tests via turbo)
- `pnpm run test:unit` - Run all unit tests using Vitest
- `pnpm run test:types` - Run TypeScript type checks
- Individual package: `cd packages/[package-name] && pnpm run test:unit`

### Linting
- `pnpm run lint` - Check and fix code style using Biome

## TypeScript Conventions

### Code Style
- Use **Biome** for formatting (configuration in repo root)
- Single quotes for strings, double quotes for JSX attributes
- 2-space indentation, 100 character line width
- Trailing commas in all contexts
- Arrow functions with parentheses: `(param) => value`
- Semicolons as needed (not required)

### Type Definitions
- **Always use `type` instead of `interface`** for all type definitions
- **Always use `Array<T>` instead of `T[]`** for array types
- Use descriptive generic parameter names beyond single letters
- Leverage conditional types and mapped types for complex transformations
- Prefer `keyof` and mapped types extensively
- Prefer type-level programming over runtime checks
- Export types alongside implementation when needed

### Import/Export Patterns
- Use explicit `.js` file extensions in imports for ESM compatibility
- Organize imports: external packages first, then internal `@enkaku/` packages
- Use barrel exports (`index.ts`) for package entry points
- Re-export types from nested modules when appropriate
- Import from other packages using full `@enkaku/` package names

### Error Handling
- Create custom error classes extending base `Error`
- Use Result types for fallible operations
- Implement error serialization for RPC/network contexts
- Include error codes and structured error information

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

## Testing Conventions

### Test Organization
- Place tests in `test/` directory (not `__tests__`)
- Use `.test.ts` suffix for test files
- Name test files to match the source file being tested
- Use **Vitest** as the test runner (not Jest)

### Test Structure
- Import test functions from `vitest`: `import { describe, expect, test } from 'vitest'`
- Group related tests with `describe` blocks
- Use descriptive test names that explain behavior
- Use `test` (not `it`) for test cases

### Async Testing
- Use async/await for asynchronous tests
- Test both success and failure cases
- Use proper cleanup with disposers when needed
- Test timeout scenarios for long-running operations

### Integration Testing
- Integration tests live in `tests/integration/` at the repo root
- Test cross-package functionality
- Use real transport mechanisms where appropriate

### Mocking
- Mock external dependencies sparingly
- Use real implementations for internal package dependencies
- Mock network calls and file system operations

### Coverage
- Aim for high coverage on core functionality
- Focus on edge cases and error conditions
- Test the public API surface thoroughly

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
- **token**: JWT-like token system for authentication
- **stream**: Stream utilities for data flow management
- **execution**: Execution chain management for procedures
- **keystore**: Key management for different environments (node, browser, expo)

### Dependency Management
- Use workspace protocol for internal dependencies: `@enkaku/package-name`
- Use pnpm catalog for shared dependency versions (defined in `pnpm-workspace.yaml`)
- Keep external dependencies minimal and focused
- Use peer dependencies for optional integrations
- Avoid circular dependencies between packages

### Development Workflow
1. Install dependencies: `pnpm install`
2. Build all packages: `pnpm run build`
3. Run tests: `pnpm run test`
4. Lint code: `pnpm run lint`

The build system uses incremental compilation - packages build in dependency order with proper caching.

## Getting Help

- Use `/enkaku:discover` to navigate by domain or use case
- Domain skills provide focused patterns and examples
- Reference `docs/capabilities/` for comprehensive documentation
- Ask questions when you need clarification

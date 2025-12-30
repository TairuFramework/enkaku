# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build
- `pnpm run build` - Build types and JavaScript files
- `pnpm run build:types` - Build TypeScript declarations only
- `pnpm run build:js` - Build JavaScript files only (using turbo)

### Testing
- `pnpm run test:types` - Run TypeScript checks
- `pnpm run test:unit` - Run all unit tests using Vitest
- `pnpm run test` - Run TypeScript and unit tests

### Linting
- `pnpm run lint` - Check and fix code style using Biome

### Individual Package Testing
Most packages have individual test suites. Run tests for specific packages:
- `cd packages/[package-name] && pnpm test`

## Architecture

This is a monorepo for **Enkaku**, an RPC framework for modern applications. Key architectural components:

### Core Structure
- **Monorepo**: Uses pnpm workspaces with packages in `packages/` directory
- **Build System**: Turbo for build orchestration, SWC for compilation
- **Testing**: Vitest test runner
- **Linting**: Biome for code formatting and linting

### Key Packages
- **protocol**: Core protocol definitions, schemas, and types
- **client**: Client-side RPC implementation with typed procedure calls
- **server**: Server-side RPC implementation with handler registration
- **transport**: Transport layer abstractions (http, socket, node-streams)
- **token**: JWT-like token system for authentication
- **stream**: Stream utilities for data flow management
- **execution**: Execution chain management for procedures
- **keystore**: Key management for different environments (node, browser, expo)

### Transport Layer
The framework supports multiple transport mechanisms:
- HTTP transports (client/server)
- Socket transports
- Node.js streams transport
- Message-based transports

### Type System
- Heavy use of TypeScript generics for type-safe RPC calls
- Protocol definitions drive client/server type generation
- Schema validation using JSON Schema and AJV

## TypeScript Conventions

### Type Definitions
- **Always use `type` instead of `interface`** for defining types
- **Always use `Array<T>` instead of `T[]`** for array types
- Use descriptive generic parameter names beyond single letters
- Leverage conditional types and mapped types for complex transformations

### Security
- Token-based authentication with signing/verification
- Keystore abstractions for secure key management
- Access control mechanisms in server implementation

## Development Workflow

1. Install dependencies: `pnpm install`
2. Build all packages: `pnpm run build`
3. Run tests: `pnpm run test`
4. Lint code: `pnpm run lint`

The build system uses incremental compilation - packages build in dependency order with proper caching.
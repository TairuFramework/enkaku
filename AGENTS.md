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

**Authentication & Security**: Built-in token system provides JWT-like authentication with signing and verification. Keystore abstractions enable secure key management across different environments (Node.js, browser, React Native).

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
- `pnpm run test:types` - Run TypeScript checks
- `pnpm run test:unit` - Run all unit tests using Vitest
- `pnpm run test` - Run TypeScript and unit tests

### Linting
- `pnpm run lint` - Check and fix code style using Biome

### Individual Package Testing
Most packages have individual test suites. Run tests for specific packages:
- `cd packages/[package-name] && pnpm test`

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

## Architecture Overview

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

---
name: enkaku:discover
description: Explore Enkaku capabilities by domain or use case
---

# Enkaku Capability Discovery

Welcome to Enkaku's progressive discovery system. This skill helps you navigate Enkaku's capabilities through two complementary paths: exploring by technical domain or by what you want to build.

## How to Explore

### By Domain (When you know the technical area)

Navigate to specific technical domains for deep dives into patterns, packages, and usage examples:

- **Transport** - HTTP, WebSocket, Node streams, message-based transports
- **Authentication & Security** - Tokens, keystores, access control, signing
- **Streaming & Data Flow** - Stream utilities, async patterns, backpressure handling
- **Schema & Validation** - JSON Schema, codec system, type generation
- **Execution & Middleware** - Execution chains, capabilities, procedure composition

→ **Use domain skills**: `/enkaku:transport`, `/enkaku:auth`, `/enkaku:streaming`, `/enkaku:validation`, `/enkaku:execution`

Each domain skill provides:
- Complete working code examples
- Package recommendations for different scenarios
- Key patterns and best practices
- Decision guidance for choosing between options

### By Use Case (When you know what to build)

Start with what you want to accomplish and find relevant patterns:

- **Building an RPC server** - Set up handlers, routing, middleware
- **Adding real-time communication** - WebSocket connections, streaming responses
- **Securing endpoints** - Authentication, authorization, token management
- **Handling streaming data** - Async iterators, backpressure, flow control
- **Validating requests/responses** - Schema definition, runtime validation

→ **Reference**: `docs/capabilities/use-cases/*.md`

Use case documentation provides end-to-end examples showing how multiple domains work together to solve real problems.

## Quick Package Overview

### Core Packages

Most applications start with these packages:

- **@enkaku/client** - Type-safe RPC client with full TypeScript inference
- **@enkaku/server** - RPC server with handler registration and middleware
- **@enkaku/standalone** - Combined client/server for same-process communication

These packages provide the essential RPC functionality. Import them to make remote procedure calls (client) or handle them (server).

### Foundation Packages

Beyond the core RPC packages, Enkaku includes specialized packages for transport, authentication, streaming, validation, and more. These foundation packages are organized by domain - use the domain skills above to explore them.

## Navigation Strategy

**New to Enkaku?** Start with `/enkaku:core-rpc` to understand the fundamentals of protocol definition, client calls, and server handlers.

**Know your technical need?** Jump to the relevant domain skill (e.g., `/enkaku:transport` for communication options).

**Building something specific?** Check use case documentation in `docs/capabilities/use-cases/` for complete examples.

**Need utilities?** Use `/enkaku:utilities` for result types, JSON patches, and code generation.

## Getting Deeper

Once you're familiar with a domain, reference the detailed documentation:

- **API docs**: `docs/capabilities/[domain]/api.md` - Exhaustive API reference
- **Architecture**: `docs/capabilities/[domain]/architecture.md` - Design decisions and internals
- **Package READMEs**: `packages/[package-name]/README.md` - Package-specific details

The progressive discovery system is designed to load what you need, when you need it. Start here, navigate to domain skills for focused learning, and dive into comprehensive docs when you need every detail.

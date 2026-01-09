---
name: enkaku:discover
description: Explore Enkaku capabilities by domain or use case
---

# Enkaku Capability Discovery

## How to Explore

### By Domain (When you know the technical area)
- Transport - HTTP, WebSocket, Node streams, message-based
- Authentication & Security - Tokens, keystores, access control
- Streaming & Data Flow - Stream utilities, async patterns
- Schema & Validation - JSON Schema, type generation
- Execution & Middleware - Execution chains, capabilities

→ Use: /enkaku:transport, /enkaku:auth, etc.

### By Use Case (When you know what to build)
- Building an RPC server
- Adding real-time communication
- Securing endpoints
- Handling streaming data
- Validating requests/responses

→ Reference: docs/capabilities/use-cases/*.md

## Quick Package Overview

**Core packages** (most applications start here):
- @enkaku/client - Type-safe RPC client
- @enkaku/server - RPC server with handler registration
- @enkaku/standalone - Combined client/server

**Foundation packages**: Organized by domain (see domain skills)

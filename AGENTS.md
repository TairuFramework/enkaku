# AGENTS.md

> **For AI Agents:** This document provides practical guidance for LLMs working with the Enkaku codebase.

## What is Enkaku?

Enkaku is a modern, type-safe RPC framework for TypeScript applications. It provides protocol-driven client-server communication with multiple transport layers (HTTP, WebSocket, Node.js streams), built-in JWT-like authentication and keystore management, and end-to-end type safety from protocol definitions through to handler implementations. It is the lowest-level framework in the Yulsi stack -- both Kubun and Mokei depend on it.

## Key Concepts

- **Protocol definitions** drive the entire type system -- define procedures once, get typed clients and servers automatically
- **Four procedure types**: request (single response), event (fire-and-forget), stream (server-to-client data flow), channel (bidirectional communication)
- **Transport abstraction** allows swapping communication mechanisms (HTTP, WebSocket, Node.js streams) without changing application code
- **Token-based auth** with signing/verification and environment-specific keystores (Node.js, browser, React Native)
- **Schema validation** using JSON Schema and AJV provides runtime type checking alongside compile-time safety

## Quick Discovery

Use the progressive discovery system to explore capabilities:

```
/enkaku:discover
```

Domain skills: `/enkaku:transport`, `/enkaku:auth`, `/enkaku:streaming`, `/enkaku:validation`, `/enkaku:execution`, `/enkaku:core-rpc`, `/enkaku:utilities`, `/enkaku:platform`

## Commands

```bash
pnpm run build        # Build all packages (types then JS)
pnpm run test         # Run all tests (type checks + unit tests)
pnpm run test:unit    # Unit tests only
pnpm run lint         # Format and lint all packages
```

## Additional Context

Load these files based on your current task:

| Task | Files to read |
|------|---------------|
| Planning | `docs/agents/architecture.md` |
| Implementation | `docs/agents/conventions.md`, `docs/agents/development.md` |
| Review | `docs/agents/conventions.md`, `docs/agents/architecture.md`, `docs/agents/development.md` |

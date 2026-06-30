# AGENTS.md

> **For AI Agents:** This document provides practical guidance for LLMs working with the Enkaku codebase.

## What is Enkaku?

Enkaku is a modern, type-safe RPC framework for TypeScript applications. It provides protocol-driven client-server communication with multiple transport layers (HTTP, WebSocket, Node.js streams, MessagePort, Electron IPC), schema-validated runtime safety, and end-to-end type safety from protocol definitions through to handler implementations.

Enkaku is the RPC layer of the five-repo Yulsi stack. It depends on sibling repos rather than bundling cross-cutting concerns: build/tooling from `@kigu/*`, runtime/async/schema/stream/execution utilities from `@sozai/*`, and identity/auth (tokens, capabilities, keystores) from `@kokuin/*`. Group/MLS and hub messaging live downstream in `@kumiai/*`. As of the 0.18 stack refactor, this repo ships RPC core, transports, OTel naming, and React bindings only -- authentication and keystores are no longer in-repo.

## Key Concepts

- **Protocol definitions** drive the entire type system -- define procedures once, get typed clients and servers automatically
- **Four procedure types**: request (single response), event (fire-and-forget), stream (server-to-client data flow), channel (bidirectional communication)
- **Transport abstraction** allows swapping communication mechanisms (HTTP, WebSocket, Node.js streams) without changing application code
- **Procedure-level access control** enforced by the server, using token/capability identities supplied by `@kokuin/*` (auth and keystores are no longer in-repo)
- **Schema validation** using JSON Schema (`@sozai/schema`) provides runtime type checking alongside compile-time safety

## Quick Discovery

Use the progressive discovery system to explore capabilities:

```
/enkaku:discover
```

Domain skills: `/enkaku:transport`, `/enkaku:core-rpc`. Identity/auth and utility domains moved out in the 0.18 split -- see `/kokuin:*` and `/sozai:*` (mapped in `/enkaku:discover`).

## Commands

```bash
pnpm run build        # Build all packages (types then JS)
pnpm run test         # Run all tests (type checks + unit tests)
pnpm run test:unit    # Unit tests only
pnpm run lint         # Format and lint all packages
```

## Important Guardrails

**DO NOT:**
- Use `interface` for type definitions (use `type`)
- Use lowercase abbreviations in names (`ID` not `Id`, `HTTP` not `Http`, `JWT` not `Jwt`)
- Use `T[]` instead of `Array<T>`
- Use `any` type -- use `unknown`, `Record<string, unknown>`, or a more specific type
- Use `npm`/`npx` -- always use `pnpm`/`pnpx`
- Edit generated files (`.gen.ts`, `__generated__/`, `lib/`, `schema.graphql`)
- Mutate builder internals or restructure IDs if it would invalidate content-addressed digests
- Create new packages without checking with the user -- keep functionality in existing packages

## Additional Context

Load these files based on your current task:

| Task | Files to read |
|------|---------------|
| Planning | `docs/agents/architecture.md` |
| Implementation | `docs/agents/conventions.md`, `docs/agents/development.md` |
| Review | `docs/agents/conventions.md`, `docs/agents/architecture.md`, `docs/agents/development.md` |

## Workflow Skills

| Skill | Purpose |
|-------|---------|
| `/dev-loop` | Orchestrate the full development cycle with session resumption |
| `/project-loop` | Manage project priorities, roadmap, architecture review, and triage |
| `/complete` | Summarise finished plan, move to `completed/`, clean up ephemeral files |
| `/archive` | Consolidate unreferenced completed plans into monthly summaries |

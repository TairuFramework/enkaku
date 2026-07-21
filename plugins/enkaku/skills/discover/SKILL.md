---
name: discover
description: Use when exploring Enkaku RPC capabilities - progressive discovery of this repo's domain skills.
---

# Enkaku Capability Discovery

As of the 0.18 stack split, Enkaku is the **RPC-only** layer of the Yulsi stack: protocol,
client, server, transports, OTel naming, and React bindings. Identity/auth, MLS/group/hub,
and the shared utilities it builds on live in sibling repos — see *Cross-repo* below.

## How to Explore

### By Domain (when you know the technical area)

- **Transport** — HTTP, TCP/Unix sockets, Node streams, MessagePort, Electron IPC.
  Choose your transport based on communication pattern and deployment: HTTP for
  request-response, serverless, and server-to-client streaming over SSE; sockets for
  process-to-process IPC on one host; Node streams for pipe-based local IPC; MessagePort for
  workers/iframes; Electron IPC for desktop. Each has different latency, scalability, and
  browser-compatibility trade-offs. There is no WebSocket transport in this repo.
  → `/enkaku:transport`

- **Core RPC** — protocol definitions, client, server, standalone.
  Define a protocol once and get typed clients and servers: the four procedure types
  (request, event, stream, channel), handler registration, execution chains, access control,
  replay protection, and lifecycle events.
  → `/enkaku:core-rpc`

### By Use Case (when you know what to build)

- **Building an RPC server** — protocol definition → typed handlers → routing →
  execution-chain middleware → transport. `/enkaku:core-rpc` + `/enkaku:transport`.
- **Adding real-time communication** — server-to-client push over SSE-backed HTTP channels, or
  a persistent socket/MessagePort connection. Note there is no built-in reconnection: an SSE
  disconnect resets the transport to idle and errors the readable. `/enkaku:transport`.
- **In-process / testing** — `@enkaku/standalone` wires client and server directly with no
  transport. `/enkaku:core-rpc`.

## Quick Package Overview (13 packages)

**Core RPC**
- **@enkaku/protocol** — protocol definitions, schemas, and types.
- **@enkaku/client** — type-safe RPC client with full TypeScript inference.
- **@enkaku/server** — RPC server: handler registration, access control, `HandlerError`.
- **@enkaku/standalone** — combined client + server for same-process communication.

**Transport**
- **@enkaku/transport** — generic transport abstraction.
- **@enkaku/http-fetch** — HTTP client transport (POST sessions, SSE).
- **@enkaku/http-serve** — HTTP server transport (bounded body, `413` on overflow).
- **@enkaku/socket** — TCP/Unix socket transport over `node:net`. Exports `SocketTransport`,
  which takes a socket, a socket factory, or a path to connect to; the package provides no
  listener, so a server supplies its own accepted sockets.
- **@enkaku/node-streams** — Node.js streams transport.
- **@enkaku/message** — MessagePort transport (workers, iframes).
- **@enkaku/electron** — Electron IPC transport (sender allowlist).

**Observability / Platform**
- **@enkaku/otel** — Enkaku's OpenTelemetry naming: `createTracer`, `EnkakuSpanNames`,
  `EnkakuAttributeKeys`. The W3C Trace Context codecs live in `@sozai/otel`.
- **@enkaku/react** — React bindings for the RPC client.

## Cross-repo (moved out in the 0.18 split)

- **Identity, tokens, capabilities, keystores, JWE** → `@kokuin` — `/kokuin:discover`,
  `/kokuin:auth`, `/kokuin:capability`.
- **Schema/codec validation, streaming/dataflow, runtime, logging/tracing, Result/patch**
  → `@sozai` — `/sozai:discover`, `/sozai:validation`, `/sozai:dataflow`, `/sozai:runtime`,
  `/sozai:observability`, `/sozai:primitives`.
- **MLS/group, hub, broadcast** → `@kumiai`.

---
name: enkaku:discover
description: Explore Enkaku capabilities by domain or use case
---

# Enkaku Capability Discovery

## How to Explore

### By Domain (When you know the technical area)

Navigate to specific technical domains to explore packages, patterns, and implementation strategies:

- **Transport** - HTTP, WebSocket, Node streams, message-based transports
  Choose your transport layer based on your application's communication patterns and deployment environment. HTTP transports work well for traditional request-response patterns and serverless deployments, WebSocket for bidirectional real-time communication and push notifications, and Node streams for pipe-based data flow and local inter-process communication. Each transport has different trade-offs for latency, scalability, and browser compatibility. Use `/enkaku:transport` to explore the options and understand when to use each transport mechanism.

- **Authentication & Security** - Tokens, keystores, encryption, access control
  Secure your RPC endpoints with Enkaku's token system, keystore abstractions, and JWE message-level encryption. The framework provides JWT-like tokens with signing and verification, ECDH-ES encryption with envelope modes (plain, jws, jws-in-jwe, jwe-in-jws), and keystore implementations for different environments (Node.js, browser, React Native, Electron). Use `/enkaku:auth` to learn about authentication patterns, token validation, encryption, access control strategies, and how to choose the right keystore implementation for your security requirements.

- **Streaming & Data Flow** - Stream utilities, async patterns
  Handle streaming data efficiently with async iterators, backpressure management, and flow control. Enkaku's stream utilities help you work with asynchronous data sources, implement streaming responses, and manage resource cleanup. The streaming system integrates with Node.js streams, browser ReadableStreams, and async iterators, providing a unified interface for different streaming paradigms. Use `/enkaku:streaming` to explore streaming patterns, learn how to handle real-time data flows, and understand memory-efficient processing of large datasets.

- **Schema & Validation** - JSON Schema, type generation
  Ensure type safety and runtime validation with Enkaku's schema system. Define schemas using JSON Schema, generate TypeScript types automatically, and validate data at runtime using the codec system powered by AJV. The schema system bridges compile-time and runtime type safety, catching errors early in development while preventing invalid data at runtime. Use `/enkaku:validation` to learn about schema definition, validation strategies, type generation workflows, and how to maintain consistency between your types and runtime validators.

- **Execution & Middleware** - Execution chains, capabilities
  Build composable procedure handlers with execution chains and capability-based patterns. The execution system lets you implement middleware, compose handlers, and manage request/response processing pipelines. Middleware can handle cross-cutting concerns like logging, authentication, rate limiting, and error handling in a composable way. Use `/enkaku:execution` to explore execution patterns, understand how to build flexible procedure implementations, and learn best practices for middleware composition and capability management.

→ Use: /enkaku:transport, /enkaku:auth, etc.

### By Use Case (When you know what to build)

Start with what you want to accomplish and find complete examples showing how domains work together:

- **Building an RPC server**
  Set up a complete RPC server with handler registration, routing, and middleware. Learn how to define procedures, implement handlers with proper typing, and compose middleware for cross-cutting concerns like logging and authentication. This use case covers the full server-side setup from protocol definition to deployment.

- **Adding real-time communication**
  Implement bidirectional communication using WebSocket transports for real-time features. Learn how to establish persistent connections, handle connection lifecycle events, implement heartbeat mechanisms, and manage client reconnection strategies. This use case shows how to build chat systems, live dashboards, and collaborative features.

- **Securing endpoints**
  Protect your RPC endpoints with authentication and authorization mechanisms. Learn how to implement token-based auth, validate tokens on every request, manage keystore configurations, and implement role-based access control. This use case demonstrates security best practices and common authentication patterns.

- **Handling streaming data**
  Work with asynchronous data streams for large datasets or continuous data flows. Learn how to implement streaming responses, handle backpressure correctly, manage resource cleanup, and compose stream transformations. This use case covers file uploads, log streaming, and real-time data processing scenarios.

- **Validating requests/responses**
  Ensure data integrity with schema validation and type safety throughout your RPC system. Learn how to define JSON schemas, generate TypeScript types from schemas, validate incoming requests automatically, and handle validation errors gracefully. This use case shows how to maintain type safety from client to server.

→ Reference: docs/capabilities/use-cases/*.md

## Quick Package Overview

**Core packages** (most applications start here):

- **@enkaku/client** - Type-safe RPC client with full TypeScript inference
  The client package provides the foundation for making remote procedure calls from your application. It handles request serialization, transport abstraction, and automatic type inference based on your protocol definitions. The client automatically derives procedure types from your protocol, providing autocomplete and type checking at compile time. Use this when you need to call RPC procedures from a client application with complete type safety and seamless developer experience.

- **@enkaku/server** - RPC server with handler registration and middleware support
  The server package lets you implement RPC endpoints by registering handlers for your procedures. It provides middleware composition, error handling, and transport integration. The server validates incoming requests against your protocol schemas and ensures type-safe handler implementations. Use this when you need to handle RPC calls on the server side with full control over request processing, response generation, and middleware orchestration.

- **@enkaku/standalone** - Combined client and server for same-process communication
  The standalone package provides both client and server functionality in a single package, optimized for in-process communication. It's useful for testing, local development, and scenarios where client and server run in the same process. The standalone package eliminates network overhead by using direct function calls while maintaining the same API as remote communication. Use this for simpler setups, unit testing your RPC handlers, or when you don't need separate client/server deployments.

**Foundation packages**: Organized by domain (see domain skills)

Beyond the three core packages, Enkaku includes specialized foundation packages for transport implementations, authentication mechanisms, streaming utilities, schema validation, and execution management. These packages are organized by technical domain and work together to provide complete RPC functionality. The protocol package defines types and schemas, transport packages handle communication, the token package manages authentication, and the execution package coordinates middleware and handlers. Use the domain skills above (`/enkaku:transport`, `/enkaku:auth`, etc.) to explore specific areas and discover which foundation packages you need for your application's requirements.

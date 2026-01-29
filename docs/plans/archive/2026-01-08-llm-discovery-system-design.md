# LLM Progressive Discovery System for Enkaku

**Status:** partial

**Date**: 2026-01-08
**Purpose**: Enable LLMs to progressively discover Enkaku's capabilities without loading the entire codebase

**What was implemented:**
- AGENTS.md entry point with discovery pointers
- Agent docs structure (`docs/agents/architecture.md`, `conventions.md`, `development.md`)
- Discovery skill (`/enkaku:discover`)
- 6 of 8 domain skills: transport, auth, core-rpc, streaming, validation, discover
- All 5 domain capability docs (`docs/capabilities/domains/`)
- All 5 use-case docs (`docs/capabilities/use-cases/`)

**Remaining work (moved to `docs/plans/backlog/`):**
- `/enkaku:execution` skill (referenced in discover.skill.md but not created)
- `/enkaku:utilities` skill
- `/enkaku:platform` skill

---

## Problem Statement

Enkaku is a modular RPC framework with 28+ packages serving as foundational primitives for building applications. LLMs working with Enkaku face challenges:

- **Context overload**: Loading all package documentation exhausts context windows
- **Discovery difficulty**: Hard to know what capabilities exist without exploring everything
- **Pattern confusion**: Understanding how packages work together requires deep codebase knowledge
- **Use-case mapping**: Translating "I want to build X" to "I need packages Y and Z" is non-obvious

**Primary use case**: LLMs helping developers build applications and libraries using Enkaku's primitives (not contributing to Enkaku itself).

---

## Solution Overview

Create a progressive discovery system combining:

1. **AGENTS.md** - Lightweight entry point for all AI agents
2. **Discovery skill** - Guided exploration by domain or use case
3. **Domain skills** - Deep dives into specific capability areas
4. **Capability docs** - Comprehensive patterns and examples

**Philosophy**:
- Progressive loading: Start minimal, load details only when needed
- Use-case oriented: Help LLMs understand "what can I build?" not just "what packages exist?"
- Pattern-focused: Show how packages work together, not just individual APIs
- Context efficient: Each skill/doc sized for practical usage (~2-3k tokens)

---

## Architecture

### File Structure

```
/AGENTS.md                                    # Entry point, replaces CLAUDE.md
/docs/
  /plans/                                     # Design documents
  /capabilities/
    /domains/                                 # Domain-specific detailed docs
      transport.md
      authentication.md
      streaming.md
      data-flow.md
      validation.md
      execution.md
    /use-cases/                               # Tutorial-style use-case guides
      building-rpc-server.md
      real-time-communication.md
      securing-endpoints.md
      handling-streaming-data.md
      validating-requests.md
  /skills/                                    # Agent-invocable skills
    discover.skill.md
    transport.skill.md
    streaming.skill.md
    auth.skill.md
    validation.skill.md
    execution.skill.md
```

### Information Flow

```
Developer asks LLM to build something
         ↓
LLM reads AGENTS.md (~1k tokens)
         ↓
LLM invokes /enkaku:discover (~1k tokens)
         ↓
    ┌─────────────┴─────────────┐
    ↓                           ↓
Domain path                 Use-case path
    ↓                           ↓
Invoke domain skill         Read use-case doc
(e.g., /enkaku:transport)   (e.g., building-rpc-server.md)
(~2-3k tokens)              (~2-3k tokens)
    ↓                           ↓
Reference capability doc    References domain docs as needed
(docs/capabilities/domains/transport.md)
(~3-5k tokens)
    ↓
LLM generates code with patterns and examples
```

**Total context per interaction**: 5-10k tokens (vs. loading all 28 packages)

---

## Component Specifications

### 1. AGENTS.md

**Purpose**: Provide lightweight entry guidance without loading everything upfront.

**Content**:
- Project overview (what is Enkaku?)
- Pointer to `/enkaku:discover` skill
- List of available skills
- Core concepts (2-3 sentences each)
- Commands (from existing CLAUDE.md)
- TypeScript conventions (from existing CLAUDE.md)

**Size**: ~1000 tokens

**Key principle**: Direct to skills immediately, don't try to document everything inline.

---

### 2. Discovery Skill (`/enkaku:discover`)

**Purpose**: Entry point for exploring capabilities through guided navigation.

**Structure**:
```markdown
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
```

**Size**: ~1000 tokens

**Navigation**: Two-tier system - discovery skill points to domain skills OR use-case docs.

---

### 3. Domain Skills (e.g., `/enkaku:transport`)

**Purpose**: Load detailed patterns for a specific capability area.

**Structure Template**:
```markdown
---
name: enkaku:[domain]
description: [Domain] patterns, packages, and usage examples
---

# Enkaku [Domain]

## Packages in This Domain

**Core**: @enkaku/[name]
**Implementations**: @enkaku/[impl1], @enkaku/[impl2]

## Key Patterns

### Pattern 1: [Name]
```typescript
[Complete working example with imports]
```
**Use case**: [when to use]
**Key points**: [3-5 bullets]

### Pattern 2-4: [Additional patterns]

## When to Use What

[Decision guidance for choosing between packages]

## Related Domains

- See /enkaku:[related] for [topic]

## Detailed Reference

For complete API: docs/capabilities/domains/[domain].md
```

**Size**: ~2-3k tokens per domain skill

**Focus**: Common patterns with runnable code examples, decision guidance, cross-references.

**Domains to create**:
1. Transport (`transport.skill.md`)
2. Authentication (`auth.skill.md`)
3. Streaming (`streaming.skill.md`)
4. Validation (`validation.skill.md`)
5. Execution (`execution.skill.md`)
6. Data Flow (`data-flow.skill.md`)

---

### 4. Capability Documentation

Two types: Domain docs and Use-case docs.

#### Domain Capability Docs (`docs/capabilities/domains/*.md`)

**Purpose**: Comprehensive reference for a domain with full pattern catalog.

**Structure**:
```markdown
# [Domain Name] - Detailed Reference

## Overview
[2-3 sentences]

## Package Ecosystem

### Core Package: @enkaku/[name]
- Purpose: [what it does]
- Key exports: [main types, functions, classes]
- Dependencies: [requirements]

### Related Packages
[Similar structure for each]

## Common Patterns

### Pattern: [Name]
**Use case**: [when to use]
**Implementation**:
```typescript
[Complete working example]
```
**Key points**:
- [Best practice 1]
- [Gotcha 2]
- [Tip 3]

[3-5 patterns total]

## Package Interactions

[How packages in this domain work together]
[ASCII diagrams or mermaid if helpful]

## API Quick Reference

[Concise API surface for key exports]

## Examples by Scenario

### Scenario 1: [Real-world use case]
[Complete code example]

[2-3 scenarios]

## Troubleshooting

[Common issues and solutions]
```

**Size**: ~3-5k tokens per doc

**Principle**: Comprehensive but focused on patterns, not exhaustive API docs.

#### Use-Case Capability Docs (`docs/capabilities/use-cases/*.md`)

**Purpose**: Tutorial-style guides for building specific things.

**Structure**:
```markdown
# [Use Case]: [Title]

## Goal
[What you'll build in 1-2 sentences]

## Prerequisites
```bash
pnpm add @enkaku/client @enkaku/server
```

## Step-by-Step Implementation

### Step 1: [Setup]
```typescript
[Code with full imports]
```
[Explanation of what this does and why]

### Step 2-4: [Additional steps]

## Complete Example
```typescript
[Full working code that can be copied]
```

## Extending This Example
- How to add feature X
- How to handle scenario Y
- Performance considerations

## Related Capabilities
- Domain: [Link to domain doc]
- Use cases: [Related use-case docs]
```

**Size**: ~2-3k tokens per doc

**Principle**: Goal-oriented, complete runnable examples, shows progression.

**Initial use cases to create**:
1. Building an RPC server
2. Adding real-time communication
3. Securing endpoints with authentication
4. Handling streaming data
5. Validating requests and responses

---

## Domain Organization

Based on Enkaku's package structure, organize into these domains:

### 1. Transport Domain
**Packages**: `transport`, `http-client-transport`, `http-server-transport`, `socket-transport`, `node-streams-transport`, `message-transport`

**Focus**: Communication mechanisms, choosing transports, custom transports

### 2. Authentication & Security Domain
**Packages**: `token`, `node-keystore`, `browser-keystore`, `expo-keystore`, `electron-keystore`

**Focus**: Token generation/verification, key management, platform-specific keystores

### 3. Streaming & Data Flow Domain
**Packages**: `stream`, `async`, `flow`, `event`

**Focus**: Stream utilities, async patterns, data transformation, event handling

### 4. Schema & Validation Domain
**Packages**: `schema`, `codec`

**Focus**: JSON Schema usage, type generation, validation, encoding/decoding

### 5. Execution & Middleware Domain
**Packages**: `execution`, `capability`

**Focus**: Execution chains, middleware patterns, capability-based access control

### 6. Core RPC Domain
**Packages**: `protocol`, `client`, `server`, `standalone`

**Focus**: Core RPC concepts, protocol basics, client/server setup

### 7. Utilities Domain
**Packages**: `result`, `patch`, `generator`

**Focus**: Result types, JSON patching, code generation

### 8. Platform-Specific Domain
**Packages**: `react`, `electron-rpc`

**Focus**: Platform integrations, React hooks, Electron patterns

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Create AGENTS.md
2. Create `/enkaku:discover` skill
3. Create docs structure (`docs/capabilities/{domains,use-cases}/`, `docs/skills/`)
4. Identify 4-5 priority domains based on most-used packages

### Phase 2: Core Domains (Weeks 2-3)
**For each domain** (iterative):
1. Create domain skill (`docs/skills/[domain].skill.md`)
2. Create capability doc (`docs/capabilities/domains/[domain].md`)
3. Test with LLM usage scenarios
4. Refine based on context usage and code quality

**Priority order**:
1. Transport (most fundamental)
2. Core RPC (client/server/protocol)
3. Authentication
4. Streaming
5. Validation

### Phase 3: Use Cases (Week 4)
1. Create 3-5 common use-case guides
2. Ensure cross-references to domain docs
3. Test end-to-end scenarios

### Phase 4: Remaining Domains (Week 5+)
Complete remaining domains:
- Execution & Middleware
- Utilities
- Platform-Specific

---

## Maintenance Strategy

### When packages change:
- Update relevant domain capability doc
- Update domain skill if pattern changes
- Update use-case docs if affected

### When adding packages:
- Determine which domain it belongs to
- Update domain skill with new package
- Add patterns to domain capability doc
- Consider if new use-case doc needed

### Quarterly review:
- Check if domain organization still makes sense
- Review most-used skills/docs
- Add use-case docs based on common questions

### Documentation style:
- Manual curation (quality over automation)
- All code examples must be complete and runnable
- Include imports in every example
- Focus on patterns, not exhaustive API coverage

---

## Success Metrics

### Qualitative:
- LLMs generate correct Enkaku code without reading package internals
- LLMs can answer "how do I...?" questions using skills alone
- Developers report LLM suggestions are more accurate

### Quantitative:
- Discovery skill usage correlates with successful task completion
- Context usage per interaction stays under 10k tokens
- Reduction in "hallucinated" APIs or incorrect patterns

### Usage patterns to monitor:
- Which domain skills are most used?
- Are use-case docs or domain docs preferred?
- What questions still require full codebase exploration?

---

## Examples

### Example Flow 1: Building an RPC Server

```
Developer: "Help me build an RPC server with HTTP transport"

LLM: [Reads AGENTS.md, sees /enkaku:discover]
LLM: [Invokes /enkaku:discover]
LLM: [Sees "Building an RPC server" use case]
LLM: [Reads docs/capabilities/use-cases/building-rpc-server.md]
LLM: [Generates code using patterns from use-case doc]

Total context: ~4k tokens
```

### Example Flow 2: Adding Authentication

```
Developer: "Add token-based auth to my RPC server"

LLM: [Reads AGENTS.md]
LLM: [Invokes /enkaku:discover]
LLM: [Sees Authentication domain]
LLM: [Invokes /enkaku:auth skill]
LLM: [Gets token generation/verification patterns]
LLM: [References docs/capabilities/domains/authentication.md for keystore setup]
LLM: [Generates code]

Total context: ~6k tokens
```

### Example Flow 3: Choosing a Transport

```
Developer: "Should I use HTTP or WebSocket transport?"

LLM: [Reads AGENTS.md]
LLM: [Invokes /enkaku:transport directly]
LLM: [Sees "When to Use What" section]
LLM: [Asks clarifying questions based on decision guidance]
LLM: [Recommends transport with reasoning]

Total context: ~3k tokens
```

---

## Design Decisions & Rationale

### Why AGENTS.md instead of CLAUDE.md?
- **Agent-agnostic**: Works with any LLM/agent system, not just Claude
- **Future-proof**: As agent ecosystems evolve, naming reflects broader usage
- **Clear intent**: Signals "this is for AI agents" to human readers

### Why skills + docs instead of just docs?
- **Progressive loading**: Skills are invoked on-demand, docs can be read selectively
- **Navigation layer**: Skills provide structure and decision guidance
- **Context efficiency**: Load 2k skill vs 5k doc unless deep dive needed

### Why two-tier (discovery + domain) instead of single entry skill?
- **Direct access**: Power users can go straight to `/enkaku:transport`
- **Guided discovery**: New users start with `/enkaku:discover`
- **Prevents sprawl**: Keeps skill count manageable (~8-10 skills)

### Why manual curation instead of auto-generated docs?
- **Pattern focus**: Auto-gen produces API listings, humans curate patterns
- **Use-case orientation**: Requires understanding developer mental models
- **Quality control**: Examples must be runnable and idiomatic
- **Context optimization**: Humans better at token-efficient writing

### Why domain organization vs. alphabetical package list?
- **Mental model**: Developers think in problems (transport, auth) not packages
- **Discovery**: Easier to explore "what can I do?" than "what is @enkaku/execution?"
- **Relationships**: Shows how packages work together in context

---

## Future Enhancements

### Short-term (3 months):
- Add mermaid diagrams for package relationships
- Create "migration guides" for moving between transports
- Add troubleshooting skill for common errors

### Medium-term (6 months):
- Interactive examples with runnable code snippets
- Performance guidance for each domain
- Testing patterns and examples

### Long-term (12 months):
- Auto-extract type signatures (but keep pattern curation manual)
- Usage analytics to identify missing use-cases
- Community-contributed use-case docs

---

## Appendix: Initial Domain Skill List

1. **`discover.skill.md`** - Entry point for exploration
2. **`transport.skill.md`** - HTTP, WebSocket, streams, custom transports
3. **`auth.skill.md`** - Tokens, keystores, signing, verification
4. **`streaming.skill.md`** - Stream utilities, async patterns, data flow
5. **`validation.skill.md`** - Schema, codec, type generation
6. **`execution.skill.md`** - Execution chains, middleware, capabilities
7. **`core-rpc.skill.md`** - Protocol, client, server basics
8. **`utilities.skill.md`** - Result types, patches, generator

Optional:
9. **`platform.skill.md`** - React, Electron integrations (if frequently used)

---

## Appendix: Initial Use-Case Doc List

1. **`building-rpc-server.md`** - Basic server setup with transport
2. **`real-time-communication.md`** - WebSocket/bidirectional patterns
3. **`securing-endpoints.md`** - Token auth, keystore setup
4. **`handling-streaming-data.md`** - Stream patterns, async iteration
5. **`validating-requests.md`** - Schema validation, type safety

Optional:
6. **`custom-transport.md`** - Building custom transport implementations
7. **`testing-rpc-apis.md`** - Testing patterns for Enkaku apps
8. **`electron-integration.md`** - IPC patterns for Electron apps

---

## Conclusion

This progressive discovery system enables LLMs to effectively work with Enkaku's 28+ packages without context overload. By providing a two-tier skill system (discovery + domain) backed by comprehensive capability docs, LLMs can:

- Start with minimal context (~1k tokens)
- Progressively load only what's needed (2-5k tokens per domain)
- Generate correct, idiomatic code using established patterns
- Navigate between domains as use cases evolve

**Next step**: Begin Phase 1 implementation (AGENTS.md, discovery skill, docs structure).

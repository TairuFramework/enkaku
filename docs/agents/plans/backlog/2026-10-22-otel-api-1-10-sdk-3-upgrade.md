# Upgrade to OpenTelemetry api 1.10 / SDK 3

Context: the 2026-10-22 dependency update bumped `@opentelemetry/api` to `^1.10.0` (and `@sozai/otel` to 0.3.4, which resolved api 1.10.0). This broke both tests in `tests/integration/otel.test.ts`: no spans were exported. The bump was reverted, and the lockfile is pinned to a single `@opentelemetry/api@1.9.1`. Upgrade in a dedicated PR.

## Root causes found

1. **Version pairing.** `@opentelemetry/sdk-trace-node@2.12.0` (and `sdk-trace-base`) declares the peer `@opentelemetry/api >=1.0.0 <1.10.0`. `@opentelemetry/sdk-trace@3.0.0` declares `>=1.10.0 <1.11.0`. api 1.10 and SDK 3 were released together (2026-10-20). Mixing api 1.10 with SDK 2.x gives two api copies. A mismatched version then refuses global registration (`Registration of version v1.10.0 for trace does not match previously registered API v1.9.1`).
2. **Dual-package hazard in api 1.10.** api 1.10 ships separate ESM (`dist/*.mjs`) and CJS (`dist/*.cjs`) builds, each with its own `ProxyTracerProvider`. `setGlobalTracerProvider` sets the delegate only on the calling instance's proxy. A tracer obtained through the ESM instance *before* a CJS SDK registers stays a non-recording `ProxyTracer`. An example is `const defaultTracer = createTracer('client')` at module load in `packages/client/src/client.ts`. A tracer obtained after registration works, because the global registry is shared. api 1.9.1 had a single CJS entry, so the hazard was absent.

## Upgrade plan

- Replace the `@opentelemetry/sdk-trace-base` and `@opentelemetry/sdk-trace-node` catalog entries with `@opentelemetry/sdk-trace ^3.0.0`. Bump `@opentelemetry/api` to `^1.10.0`. Update `tests/integration/otel.test.ts` to the SDK 3 API: read the 3.x migration guide first (provider class, `forceFlush({ timeoutMillis })`). SDK 3 requires Node `>=22.15.0` and is dual ESM/CJS, so an ESM test loads the same api instance as enkaku.
- The same SDK split applies to sibling repos: sozai `packages/flow-graph`, kokuin `packages/token`.
- Consumer hardening, in sozai: make `@sozai/otel` `createTracerFactory` return a lazy tracer that calls `trace.getTracerProvider()` on each use. Without it, a CommonJS app that registers SDK 3 (the CJS api) still gets non-recording module-level tracers from enkaku/sozai/kokuin, which load the ESM api.
- Note: the root `pnpm run test` does not run `tests/integration`. Run `pnpm --filter integration-tests exec vitest run` as part of verification. Consider wiring it into the root test.

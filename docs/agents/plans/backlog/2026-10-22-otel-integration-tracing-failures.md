# Integration otel tracing tests failing

Found while completing `docs/agents/plans/completed/2026-10-22-request-abort-before-sent.complete.md`.

`pnpm --filter integration-tests exec vitest run` fails 2 of 29 tests, both in `tests/integration/otel.test.ts`:

- `end-to-end tracing > traces a request from client through server`: no exported spans; `enkaku.client.call` is missing.
- `end-to-end tracing > traces auth failure with DID correlation`: no exported server span.

The failures reproduce with the client and http-fetch sources from before the abort work, so they are pre-existing. The likely trigger is the 2026-10-22 dependency update: `@sozai/otel` ^0.3.4, `@opentelemetry/api` ^1.10.0 newly in the catalog, and `packages/otel/package.json` changed. This is unconfirmed. The root `pnpm run test` does not run the integration package, so this went unnoticed.

Check:

- a duplicate `@opentelemetry/api` instance, since the global tracer provider is not shared across copies;
- `@sozai/otel` tracer acquisition changes.

# Request Abort Before `sent` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An aborted or timed-out call settles immediately even while its write is pending. Opt-in
`cancelOnAbort` cancels that rid's HTTP fetch. Two existing http-fetch bugs are fixed: dispose not
cancelling POSTs, and a failed abort POST killing the transport.

**Architecture:** In `@enkaku/client`, the call promise is built from `controller.result`; `sent` only
forwards its rejection into the controller. In `@enkaku/http-fetch`, a per-rid `AbortController` map is
filled at `sendSerial` entry and fired by the outgoing `abort` message. Each POST gets
`AbortSignal.any([transportSignal, perRidSignal])`. No `@enkaku/transport` change.

**Tech Stack:** TypeScript, vitest, pnpm/turbo, biome. Hono `@hono/node-server` for the integration test.

**Spec:** `docs/superpowers/specs/2026-10-22-request-abort-before-sent-design.md`

## Global Constraints

- No change to `@enkaku/transport`'s `Transport.write` signature, nor to any other transport.
- `cancelOnAbort?: boolean` on `ClientTransportParams` and `TransportStreamParams`, default `false`.
- Non-breaking; one patch intent for `@enkaku/client` and `@enkaku/http-fetch` (the enkaku `fixed`
  group moves them together).
- A per-rid cancel never errors or closes the transport; the shared SSE connect never gets a per-rid signal.
- Pre-aborted `config.signal` calls keep rejecting with the signal object (today's value).
- Repo conventions: `type` not `interface`, `Array<T>`, no `any`, `ID`/`HTTP` casing, no `protected`, pnpm only.
- Lint: `rtk proxy pnpm run lint`. Unit tests per package: `pnpm --filter <pkg> run test`.

## Review Focus

1. Abort while the request's `#createMessage` is still pending (signed clients): no late request POST.
   This is tested in Task 2.
2. Abort after headers arrive but during `res.json()`: the transport stays up. Tested in Task 4.
3. A second stream open aborted while it waits for the SSE connect: its POST never starts after SSE
   connects. Tested in Task 4.
4. Client dispose with withheld POSTs and `cancelOnAbort: false`: every fetch signal is aborted.
   Tested in Task 3.
5. Reused rid: the old call's POST settles after a new call with the same rid starts, and the new
   map entry survives. Tested in Task 4.

---

### Task 1: Client settles on abort without waiting for `sent`

**Files:**
- Modify: `packages/client/src/client.ts:189-211` (`createRequest`)
- Test: `packages/client/test/abort-before-sent.test.ts` (create)

**Interfaces:**
- Produces: `createRequest` keeps its signature `(params: CreateRequestParams<Result>) => RequestCall<Result>`.
  Call promise resolves/rejects only from `controller.result`.

- [ ] **Step 1: Write failing tests** in `abort-before-sent.test.ts`. Harness: `DirectTransports`, with
  `vi.spyOn(transports.client, 'write')` returning a never-resolving promise for `typ !== 'abort'`
  messages (abort writes resolve) and recording payloads; protocol has a `request`, a `stream` and a
  `channel` procedure. Tests:
  - `request rejects on call.abort() while write is pending`: `call.abort('Stop')`; `await expect(call).rejects` within `vi.waitFor` default; recorded payloads contain `{ typ: 'abort', rid: call.id }`.
  - `request rejects on config.signal abort while write is pending`: `AbortController`; `ac.abort('Gone')`; call rejects.
  - `request rejects on timeout while write is pending`: fake timers, `requestTimeoutMs: 1000`, advance 1000ms; `rejects.toBeInstanceOf(RequestTimeoutError)`.
  - `stream and channel reject on abort while write is pending`: `client.createStream(...).abort()` and `client.createChannel(...).abort()` both reject.
  - `pre-aborted signal rejects with the signal object`: for request, stream and channel with `AbortSignal.abort('Already')`, `await expect(call).rejects.toBe(signal)`.
  - `no unhandled rejection when sent rejects after abort`: register a `process.on('unhandledRejection')` collector as in `abort-after-failed-send.test.ts`. The write mock rejects 10ms after `call.abort()`. Wait 20ms; the collector is empty.

- [ ] **Step 2: Run** `pnpm --filter @enkaku/client exec vitest run test/abort-before-sent.test.ts`.
  Expected: the abort/signal/timeout tests time out or fail (the call is still pending); the pre-aborted test may already pass.

- [ ] **Step 3: Implement in `createRequest`**
  - Return `Object.assign(controller.result, call, { type, procedure, abort })`.
  - `abort = (reason) => controller.abort(reason)`.
  - Attach `sent.catch((error) => { if (!controller.settled) controller.error(error as RequestError) })`
    so the rejection value is forwarded unchanged and is always handled.
  - Update the comments in `createRequest` to match.

- [ ] **Step 4: Run** the new file, then `pnpm --filter @enkaku/client run test`. Expected: all pass,
  existing `abort-after-failed-send`, `request-timeout`, `channel-dispose` included.

- [ ] **Step 5: Commit** `git add packages/client && git commit -m "Settle client calls on abort before send completes"`

### Task 2: Client never writes a request whose owner already settled

**Files:**
- Modify: `packages/client/src/client.ts:519-547` (`#write`); `id?: string` config fields at `:660`, `:669`, `:762-763` and the channel equivalent (JSDoc)
- Test: `packages/client/test/abort-before-sent.test.ts`

**Interfaces:**
- Consumes: Task 1's call promise behaviour.
- Produces: `#write` contract. After `await this.#createMessage(...)`, it returns without calling
  `safeWrite` when `owner?.settled` is true and `payload.typ !== 'abort'`.

- [ ] **Step 1: Write failing test** `aborted request is never written`. With a recording write mock
  that resolves, call `client.request('test/request')` and then `call.abort()` synchronously. Await the
  call's rejection plus a 10ms tick. Recorded payload `typ`s equal `['abort']`.

- [ ] **Step 2: Run it.** Expected: FAIL, recorded `['abort', 'request']` or `['request', 'abort']`.

- [ ] **Step 3: Implement** the skip in `#write` per Interfaces. Add the JSDoc on every `id?: string`
  call-config field: "Do not reuse the ID of an aborted call while its request may still be in flight:
  replies are matched by ID only."

- [ ] **Step 4: Run** `pnpm --filter @enkaku/client run test`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -am "Skip writing calls that settled before send"`

### Task 3: http-fetch: transport signal on every POST, abort-message failure isolation

**Files:**
- Modify: `packages/http-fetch/src/index.ts`: `sendClientMessage` (`:250-298`), `send` (`:300-345`)
- Test: `packages/http-fetch/test/abort-cancel.test.ts` (create)

**Interfaces:**
- Produces: `sendClientMessage(msg, sessionID?: string, signal?: AbortSignal): Promise<void>`. It
  passes `signal ?? abortController.signal` to `sendMessage`. Task 4 passes the combined signal.

- [ ] **Step 1: Write failing tests.** Use a mock `fetch` like the one in `concurrent-sends.test.ts`,
  recording each `init.signal`. Tests:
  - `dispose aborts in-flight request POSTs`: a request POST is withheld; call `transport.dispose()`. The
    recorded signal has `aborted === true`. Task 4 repeats this test with `cancelOnAbort: true`.
  - `failed abort POST does not error the transport`: the mock rejects (`new TypeError('fetch failed')`)
    for `typ: 'abort'`. `transport.write(abort)` rejects. A following `request` write still resolves,
    and its JSON reply is read via `transport.read()`.
  - `unparsable abort response does not error the transport`: the abort reply is
    `new Response('not json', { status: 200 })`. A following request reply is still readable.
  - `failed abort POST keeps an SSE stream alive`: open a stream whose mock returns an SSE body with a
    session header, keep the stream open, and make the abort POST fail. A server event pushed after
    that is still read.

- [ ] **Step 2: Run** `pnpm --filter @enkaku/http-fetch exec vitest run test/abort-cancel.test.ts`.
  Expected: all four FAIL.

- [ ] **Step 3: Implement**
  - Add the `signal` parameter per Interfaces.
  - In `send()`'s catch, for `msg.payload.typ === 'abort'`, rethrow without `controller.error`.
  - In the `res.json()` rejection handler, absorb (no `controller.error`) when `msg.payload.typ === 'abort'`.
  - When `abortController.signal.aborted` (disposing), rethrow without `controller.error`.

- [ ] **Step 4: Run** `pnpm --filter @enkaku/http-fetch run test`. Expected: all pass.

- [ ] **Step 5: Commit** `git add packages/http-fetch && git commit -m "Cancel POSTs on dispose and isolate abort POST failures"`

### Task 4: http-fetch `cancelOnAbort`

**Files:**
- Modify: `packages/http-fetch/src/index.ts`: `TransportStreamParams` (`:57`),
  `ClientTransportParams` (`:393`), `sendSerial` (`:357`), `send`, `sendClientMessage`; `packages/http-fetch/README.md`
- Test: `packages/http-fetch/test/abort-cancel.test.ts`

**Interfaces:**
- Consumes: `sendClientMessage(msg, sessionID?, signal?)` from Task 3.
- Produces: `cancelOnAbort?: boolean` on both param types. Internal state is
  `const cancels = new Map<string, AbortController>()`, used only when the option is true.

- [ ] **Step 1: Write failing tests** (`cancelOnAbort: true` unless stated otherwise):
  - `abort cancels the in-flight request fetch`: the request POST is withheld; write `abort` for its rid.
    The recorded request signal is `aborted`, the request `write` resolves, and the abort POST was sent.
  - `default leaves the request fetch running`: same setup with the option unset. The request signal is
    not aborted.
  - `cancel during body read does not error the transport`: the response's headers resolve, but its body
    stream stays pending. Abort the rid. A following request reply is still readable.
  - `abort of a queued stream open is not delayed behind it`: first stream open (SSE connect) is
    withheld; a second stream `s2` opens and its abort is written. Once SSE connects, no POST with
    `stream:s2` is recorded.
  - `stream abort leaves the SSE session alive`: abort an established stream; a pushed event for
    another open stream is still read.
  - `reused rid: old POST settling keeps the new entry`: request `r` is cancelled; a new request `r` is
    written before the old POST settles. A second `abort r` then aborts the *new* fetch's signal, which
    proves the entry survived.
  - `ordering unchanged`: rerun the `concurrent-sends.test.ts` channel-ordering scenario with the option on.

- [ ] **Step 2: Run** the file. Expected: the new `cancelOnAbort` tests FAIL; the default and ordering
  tests pass.

- [ ] **Step 3: Implement**
  - At `sendSerial` entry, when the option is on:
    - for `typ` `request`, or `stream`/`channel` opens, `cancels.set(rid, new AbortController())`;
    - for `typ: 'abort'`, `cancels.get(rid)?.abort()` happens before chaining.
  - Pass the rid's signal down to `send` → `sendClientMessage`, combined as
    `AbortSignal.any([abortController.signal, perRid.signal])`. Never pass it to `connectSSESession`.
  - Before the POST in `sendClientMessage` (after `getSessionID()` waits), if the per-rid signal is
    already aborted, return without fetching.
  - A fetch or body rejection while the per-rid signal is aborted and the transport signal is not:
    resolve, with no `controller.error` and no enqueue.
  - Delete the entry (only if `cancels.get(rid) === thatController`) after the response body is consumed
    or the POST is skipped/failed.
  - README: document `cancelOnAbort` (default `false`, what it cancels, the SSE connect exception) and
    the RN/Expo note "import `@sozai/runtime-expo/polyfill` first (`AbortSignal.any`)".

- [ ] **Step 4: Run** `pnpm --filter @enkaku/http-fetch run test`. Expected: all pass.

- [ ] **Step 5: Commit** `git add packages/http-fetch && git commit -m "Add cancelOnAbort option to HTTP client transport"`

### Task 5: Integration test, release intent, full verification

**Files:**
- Test: `tests/integration/http-abort.test.ts` (create; harness copied from `createContext` in
  `http-transport.test.ts`, with a `transportParams` arg so `cancelOnAbort` can be set)
- Create: the patch intent via `pnpm change`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write tests.** The request handler awaits a promise that never resolves until the
  handler's `signal` aborts. Tests:
  - `four withheld requests aborted, fifth succeeds` with `cancelOnAbort: true`. Each of the four rejects
    on `abort()`; the server handler signals all fire; a fifth request to a responding procedure returns
    its result.
  - The same with `config.signal`, and with `timeout: 50`.

- [ ] **Step 2: Run** `pnpm --filter integration-tests exec vitest run http-abort.test.ts`. Expected: PASS.
  If anything fails, fix it in the owning package task's code, not in the test.

- [ ] **Step 3: Record the intent:**
  `pnpm change --bump patch --summary "Settle aborted calls before send completes; add http-fetch cancelOnAbort; cancel POSTs on dispose; isolate abort POST failures"`,
  selecting `@enkaku/client` and `@enkaku/http-fetch`. Check with `pnpm change status`.

- [ ] **Step 4: Verify:** `rtk proxy pnpm run lint`, then `rtk proxy pnpm run build`, then
  `rtk proxy pnpm run test`. Expected: all succeed.

- [ ] **Step 5: Commit** `git add -A tests/integration .changeset && git commit -m "Add HTTP abort integration test and release intent"`

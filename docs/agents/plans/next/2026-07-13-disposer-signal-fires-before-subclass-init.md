# `Disposer` runs its dispose callback before a subclass has initialized

**Origin:** found by the Task 1 review of `abort-signal-and-release-lifecycle` (2026-07-13), then hit twice more on the same branch. This is the upstream fix for a bug we have now patched in **three** places downstream.

## The bug

`Disposer` (`/Users/paul/dev/yulsi/sozai/packages/async/src/disposer.ts:54`) ends its constructor with:

```ts
this.#unsubscribeSignal = onAbort(params.signal, () => this.dispose(params.signal?.reason))
```

`onAbort` invokes its callback **synchronously** when the signal is already aborted. So constructing any `Disposer` subclass with an **already-aborted** signal runs `dispose()` from inside `super()` — before the derived constructor body has run, and therefore before `this` is initialized in the derived class.

Every real subclass's dispose callback touches `this` on its first line (`await this.#events.emit('disposing', ...)`). That throws `ReferenceError: Must call super constructor in derived class before accessing 'this'`. `Disposer` **catches it**, `console.warn`s, and **resolves `disposed` anyway**.

Net effect: `dispose()` reports success while teardown never happened. Confirmed empirically against `Server`:

```
Disposer dispose callback rejected ReferenceError: Must call super constructor in derived class...
server.disposed: DISPOSED_RESOLVED
disposing fired: 0
disposed fired: 0
```

Transports never disposed, handlers never aborted, cleanup interval never cleared — and the caller is told it all went fine.

## Why it needs fixing upstream

We fixed it per-subclass, by yielding a microtask (`await Promise.resolve()`) at the top of the dispose callback before any `this` access. That now appears in **three** places in `@enkaku`:

- `packages/transport/src/index.ts` — `Transport`
- `packages/transport/src/index.ts` — `DirectTransports`
- `packages/server/src/server.ts` — `Server`

It is load-bearing boilerplate that looks like a no-op. Every one carries a comment begging the next reader not to delete it. Any future `Disposer` subclass — in any repo in the stack — that forwards an external signal and touches `this` in its dispose callback reintroduces the bug, silently.

## Sketch

Fix it in `Disposer`: defer the signal-triggered `dispose()` invocation by a microtask, so the derived constructor always completes first. Then remove the three downstream yields.

Note the soundness argument the downstream fix relies on, which applies equally upstream: constructors are synchronous in JS — you cannot `await` inside one — so the entire synchronous unwind (out of the abort listener, out of `Disposer`'s constructor, out of `super()`, through the derived constructor's remaining field assignments) completes before the engine drains the microtask queue. A microtask continuation therefore always sees a fully-initialized `this`.

**Caveat to preserve:** this holds only while nothing between `super()` and the field assignments can throw. Nothing does today, and nothing enforces it. If something ever did, the failure mode degrades from a loud `ReferenceError` to a silent `undefined` field access.

Consider also whether `Disposer` should stop swallowing a rejected dispose callback into a *resolved* `disposed` — that swallow is what turned a loud error into a silent success, and is the reason this went unnoticed.

**Blast radius:** `Disposer` is the shared teardown primitive across the stack. Changing when the signal-triggered dispose fires is a real behavior change; it wants its own changeset and a check of every subclass in `@sozai`, `@enkaku`, `@kokuin`, and `@kumiai`.

---
'@enkaku/transport': patch
'@enkaku/server': patch
'@enkaku/client': patch
'@enkaku/http-serve': patch
---

Require `@sozai/async` `^0.2.1`, which fixes `Disposer` running its dispose callback before a subclass has initialized.

Constructing a `Disposer` subclass with an **already-aborted** signal used to invoke the dispose callback synchronously from inside `super()`. The callback's first `this` access threw a `ReferenceError` that `Disposer` swallowed into a **resolved** `disposed` -- teardown never ran, and the caller was told it succeeded. `@sozai/async@0.2.1` defers that invocation by a microtask, so the derived constructor always completes first.

`Transport`, `DirectTransports`, and `Server` each carried a local microtask yield to work around this. All three are removed: the fix now lives in the base class. The `^0.2.1` floor is load-bearing -- on `0.2.0` an already-aborted signal silently disposes nothing.

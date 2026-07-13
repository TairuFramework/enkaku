---
'@enkaku/transport': patch
---

`Transport` now forwards `params.signal` to its `Disposer`, so aborting that signal disposes the transport.

Previously `signal` was accepted, declared on `TransportParams`, and silently dropped: aborting it did nothing. Every transport subclass (`SocketTransport`, `NodeStreamsTransport`, `MessageTransport`) passes `signal` up to the base class, so all of them were affected — a caller wiring up a signal expecting "abort tears this down" got no dispose, no `disposed` event, and a leaked underlying resource.

Aborting the signal now runs the same graceful teardown as calling `dispose()`: `disposing` is emitted, queued writes are flushed (bounded), then `disposed` is emitted and the resource behind the transport is released. If you pass a `signal` today and rely on it *not* disposing the transport, stop passing it.

Also fixes teardown for a transport constructed with a signal that is **already aborted**. The disposal callback previously ran before the instance had finished initializing, threw internally, and was swallowed — so `dispose()` resolved successfully while `disposing`/`disposed` never fired and the underlying resource was never released. This affected `DirectTransports` already, and would have affected every transport once `signal` was wired through.

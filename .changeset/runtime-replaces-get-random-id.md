---
'@enkaku/server': minor
'@enkaku/client': minor
'@enkaku/http-serve': minor
'@enkaku/standalone': minor
---

**Breaking:** remove the `getRandomID` option from `ServerBaseParams`, `ClientParams`, `ServerBridgeOptions`, `ServerTransportOptions`, and `StandaloneOptions`. Pass a `Runtime` instead:

```ts
// before
new Client({ transport, getRandomID })
// after
new Client({ transport, runtime: createRuntime({ getRandomID }) })
```

`getRandomID` was shorthand for exactly that, and duplicated a default `createRuntime()` already applies. It also had a real failure mode: `runtime ?? createRuntime({ getRandomID })` meant that passing **both** silently discarded `getRandomID`, so a caller who supplied a custom generator alongside a runtime got `crypto.randomUUID()` without warning. One seam now, so the two cannot contradict each other.

`@enkaku/standalone` gains the `runtime` option it was missing, and threads it through to both the client and the server so they share one generator.

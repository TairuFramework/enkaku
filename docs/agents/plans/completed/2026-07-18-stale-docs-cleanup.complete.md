# Stale pre-split documentation cleanup

**Status:** complete
**Date:** 2026-07-18
**Origin:** 2026-07-03 repo audit (priority 4), via `next/2026-07-07-stale-docs-cleanup.md`.

## Goal

The 0.18 split moved identity/auth to `@kokuin/*`, schema/stream/async to `@sozai/*`, and
MLS/hub to `@kumiai/*`, and renamed every transport package. `docs/reference/` -- the first
place agents look -- still described the pre-split world across ~11.9k lines, and the three
skill sources in `docs/skills/` were served by nothing, so `AGENTS.md`'s `/enkaku:discover`
instruction pointed at a skill that was never registered.

Scope was `docs/reference/` plus skill delivery. `website/` was excluded and filed to
`backlog/2026-07-16-website-post-split-rewrite.md`.

## What was done

**Deleted 9 orphaned files, ~8.4k lines** -- `domains/{authentication,streaming,validation,
hub-tunnel}.md` and all of `use-cases/`. No pointer stubs: cross-repo routing already lives in
the discover skill, and stubs would duplicate it into nine files that must stay in sync. Git
history keeps the content recoverable. Survivors: `core-rpc.md`, `transport.md`,
`replay-protection.md`.

**Verified the two kept docs claim-by-claim against `packages/*/src`** rather than sweeping
renames. Added the missing `@enkaku/electron` transport section.

**Shipped the skills as a local plugin** -- `.claude-plugin/marketplace.json`,
`plugins/enkaku/.claude-plugin/plugin.json`, and `plugins/enkaku/skills/{discover,core-rpc,
transport}/SKILL.md`, wired through `.claude/settings.json`. `docs/skills/` deleted.

## Key design decisions

**Verify, do not rename.** The audit framed this as a rename sweep -- 20 stale package
references in `transport.md`. Fixing only imports would have made the docs *look* current while
leaving unverified API claims in place: worse than obviously stale, because nothing signals
distrust. Verification found the renames were the least of it. Every code example was
non-compiling. Whole APIs were documented that have never existed (`accessControl`,
`ProcedureAccessRecord`, `public: true`, `createEventStream`, `events.off()`, `client.stream()`,
`SigningIdentity`, `ErrorSchema`). Facts were inverted: `allowedOrigin` documented as defaulting
to `'*'` when it defaults to rejecting with `403`; transferables described as transferred when
they are copied; automatic SSE reconnection claimed where none exists.

**The governing rule: a claim that cannot be confirmed against `packages/*/src` is cut, not
guessed.** A shorter doc that is true beats a complete doc that is plausible.

**Subagent per doc section.** 2469 lines against 13 packages does not fit one context reliably.
Each agent got one section plus the source it describes and reported per claim: confirmed /
wrong / unverifiable. Regenerating wholesale from source was rejected -- these docs carry
hand-written prose (threat models, trade-off discussion) that source cannot reproduce.

**Plugin, not `.claude/skills/`.** Project skills cannot be namespaced and are always invoked
bare (`/discover`), so they cannot satisfy `AGENTS.md`'s `/enkaku:discover`. The marketplace
`source` must be `github`, not a relative path: local sources work only through a manual
`/plugin marketplace add`, which a checked-in config cannot rely on. **Consequence:** the plugin
resolves from GitHub HEAD, so edits do not load locally and `/enkaku:discover` cannot be
exercised before merge. kigu already lives with this constraint.

**Replay protection stays a reference doc**, reached by a pointer from the core-rpc skill. 271
lines is thin justification for a third domain skill, and it is a server-side feature the Core
RPC domain already covers.

## Corrections found in review

Two independent reviews ran after the work was called done. They converged: the plan-alignment
review's only merge blockers were the same WebSocket claims the adversarial fact-check found,
having never seen the other report.

- **There is no WebSocket transport in this repo, and no evidence one ever shipped.**
  `@enkaku/socket` is a `node:net` TCP/Unix socket transport, connect-only -- it exports
  `SocketTransport` and `connectSocket`, no listener. The claim sat in the discover skill
  (as "WebSocket transport (client + server)"), in `AGENTS.md`, and in four places in
  `docs/agents/architecture.md`. All corrected; `architecture.md` and the discover skill now
  carry an explicit negative statement, because the claim is plausible enough to be
  reintroduced from memory.
- `@enkaku/otel` exports only `createTracer`, `EnkakuSpanNames`, `EnkakuAttributeKeys` -- the
  W3C Trace Context codecs are `@sozai/otel`.
- `handleProcessPort` takes `(name, handler, options?)`; `createRendererTransportStream` takes a
  bridge name string. Both were documented as taking options objects.

**Where the process failed, for the next cycle:**

- The plugin commit contained only the `git mv` renames. The manifests were untracked and the
  content edits unstaged, so the branch briefly carried a plugin that could not load, under a
  commit message describing work it did not contain. The pre-commit hook passed because it
  lints *staged* files. Nothing checked that the commit matched its message.
- The Done criteria all passed against a broken branch, because they inspect the working tree,
  not `HEAD`.
- The file with the most errors (`discover/SKILL.md`, 5 of 9) was the one changed least, skipped
  because it has no code examples. Prose asserting package identities is exactly what rots in a
  rename-heavy split.
- Plan task checkboxes were never ticked during execution (0 of 44). Completion was verified
  from commits, the Done criteria, and the two reviews instead.

## Outcome

`AGENTS.md`'s `/enkaku:discover` reference is now true, pending merge. 134 claims were checked
against source across the five shipped docs; 9 were wrong and all were corrected.

`kokuin` and `sozai` carry the identical unwired `docs/skills/`. This establishes the pattern
for them; migrating them was out of scope -- see `backlog/2026-07-18-sibling-repo-skill-plugins.md`.

## Open check

**Post-merge only:** confirm `/enkaku:discover` loads in a fresh session and routes to
`/enkaku:core-rpc` and `/enkaku:transport`. This could not be verified earlier -- the plugin
resolves from GitHub HEAD, so the skills register only once this lands on `main`. Every other
verification criterion was met pre-merge by inspection.

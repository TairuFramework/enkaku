# @enkaku/group-rpc

High-level, MLS-aware group RPC for Enkaku. Wraps the pub/sub hub and the
broadcast primitives so a group is a first-class messaging substrate: address
the whole group (events), a subgroup, anycast a request, gather replies, or run
directed 1:1 RPC (request/stream/channel) to a single member — all over
epoch-rotating opaque topics, with an authenticated sender on every surface.

MLS specifics enter only through the consumer-supplied `GroupCrypto` port; this
package never imports `@enkaku/group` or `ts-mls`.

See `docs/superpowers/plans/2026-06-19-group-rpc.md` for the design.

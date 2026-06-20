import type { ProtocolDefinition } from '@enkaku/protocol'

/**
 * A protocol run over a group broadcast substrate. Any of the four Enkaku call
 * types (event / request / stream / channel) may be declared; the addressing
 * that decides bus vs directed delivery is applied by `@enkaku/group-rpc`,
 * not here. Mirrors the protocol-definition alias in `@enkaku/hub-protocol`.
 */
export type GroupProtocolDefinition = ProtocolDefinition

/**
 * Identity helper that returns the protocol definition unchanged while
 * preserving its literal type for downstream type inference.
 */
export function defineGroupProtocol<Definition extends GroupProtocolDefinition>(
  definition: Definition,
): Definition {
  return definition
}

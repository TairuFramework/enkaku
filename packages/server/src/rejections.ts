export enum RejectionReason {
  ABORT = 1,
  ERROR = 2,
  TIMEOUT = 3,
}

export type RejectionType<
  Reason extends RejectionReason = RejectionReason,
  Info extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly reason: Reason
  readonly info: Info
}

export class Rejection<
  Reason extends RejectionReason = RejectionReason,
  Info extends Record<string, unknown> = Record<string, unknown>,
> implements RejectionType<Reason, Info>
{
  #reason: Reason
  #info: Info

  constructor(reason: Reason, info: Info) {
    this.#reason = reason
    this.#info = info
  }

  get reason(): Reason {
    return this.#reason
  }

  get info(): Info {
    return this.#info
  }
}

export class AbortRejection<
  Info extends Record<string, unknown> = Record<string, unknown>,
> extends Rejection<RejectionReason.ABORT, Info> {
  constructor(info: Info) {
    super(RejectionReason.ABORT, info)
  }
}

export type ErrorRejectionOptions<Info extends Record<string, unknown> = Record<string, unknown>> =
  ErrorOptions & {
    info: Info
  }

export class ErrorRejection<Info extends Record<string, unknown> = Record<string, unknown>>
  extends Error
  implements RejectionType<RejectionReason.ERROR, Info>
{
  #info: Info

  constructor(message: string, options = {} as ErrorRejectionOptions<Info>) {
    super(message, { cause: options.cause })
    this.#info = options.info ?? ({} as Info)
  }

  get reason(): RejectionReason.ERROR {
    return RejectionReason.ERROR
  }

  get info(): Info {
    return this.#info
  }
}

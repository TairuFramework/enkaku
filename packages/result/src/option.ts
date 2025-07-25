type OptionState<V> = { some: true; value: V } | { some: false; value: never }

export class Option<V> {
  static none<V>(): Option<V> {
    return new Option<V>({ some: false, value: undefined as never })
  }

  static some<V>(value: V): Option<V> {
    return new Option({ some: true, value })
  }

  static of<V>(value?: V): Option<V> {
    return value == null ? Option.none() : Option.some(value)
  }

  static is<V>(value: unknown): value is Option<V> {
    return value instanceof Option
  }

  static from<V>(value: unknown): Option<V> {
    return Option.is<V>(value) ? value : Option.of(value as V)
  }

  #state: OptionState<V>

  constructor(state: OptionState<V>) {
    this.#state = state
  }

  isSome(): this is Option<V> {
    return this.#state.some
  }

  isNone(): this is Option<never> {
    return !this.#state.some
  }

  get orNull(): V | null {
    return this.isSome() ? this.#state.value : null
  }

  get orThrow(): V {
    if (this.isSome()) {
      return this.#state.value
    }
    throw new Error('Option is none')
  }

  or(defaultValue: V): V {
    return this.isSome() ? this.#state.value : defaultValue
  }

  map<U>(fn: (value: V) => U | Option<U>): Option<U> {
    return this.isSome() ? Option.from(fn(this.#state.value)) : this
  }
}

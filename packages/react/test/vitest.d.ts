import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

// `@testing-library/jest-dom` extends `expect` with DOM matchers via
// `test/setup.ts`. Its shipped type augmentation targets `declare module
// 'vitest'`, but vitest 4 declares the `Assertion` interface that `expect()`
// returns in `@vitest/expect`, so that augmentation never merges. Re-declare
// the matchers against the module that actually owns `Assertion`.
declare module '@vitest/expect' {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}

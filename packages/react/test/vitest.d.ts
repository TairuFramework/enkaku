import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

// `@testing-library/jest-dom` extends `expect` with DOM matchers via
// `test/setup.ts`. vitest 5 declares the `Assertion` interface that `expect()`
// returns in the `vitest` module, so re-declare the matchers against it.
declare module 'vitest' {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}

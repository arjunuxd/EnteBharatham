import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import 'vitest';

// @testing-library/jest-dom's own vitest entry augments `Assertion` with a
// single type parameter, which no longer matches Vitest 5's
// `Assertion<R, T>` — TypeScript silently drops the mismatched merge under
// skipLibCheck. This file re-applies the matchers with the correct
// signature so DOM matchers type-check in tests.
declare module 'vitest' {
  interface Assertion<
    R extends void | Promise<void> = void,
    T = unknown,
  > extends TestingLibraryMatchers<any, R> {}
}

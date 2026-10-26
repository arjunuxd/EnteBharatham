import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { clearApiCache } from '../lib/api';

// Vitest runs with globals disabled, so Testing Library cannot register its
// automatic cleanup. Rendered DOM must be cleared between tests.
afterEach(() => {
  cleanup();
  // Public GETs are cached in module scope; never let one test's fixture data
  // leak into the next test.
  clearApiCache();
});

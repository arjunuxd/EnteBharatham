import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration suites share the process-wide default mongoose connection
    // (connectToDatabase / disconnectFromDatabase), so test files must not
    // run concurrently — a disconnect in one file would break another.
    fileParallelism: false,
  },
});

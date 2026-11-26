import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['studio/core/tests/**/*.test.ts', 'studio/server/tests/**/*.test.ts', 'shared/tests/**/*.test.ts', 'studio/web/tests/**/*.test.ts', 'scripts/tests/**/*.test.ts'],
    environment: 'node',
  },
});

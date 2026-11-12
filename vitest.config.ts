import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/test/**/*.test.{ts,js}'],
    testTimeout: 15000,
  },
});

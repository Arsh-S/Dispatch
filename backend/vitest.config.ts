/**
 * Default Vitest configuration for unit and fast integration tests.
 *
 * Integration tests that call the real Claude CLI live in
 * src/__integration_tests__/ and are excluded here. Run them separately:
 *
 *   pnpm test:integration
 *   pnpm vitest run --config vitest.integration.config.ts
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      // Exclude the integration test directory from the default test run.
      // Integration tests require the real claude CLI, are slow, and cost money.
      'src/__integration_tests__/**',
    ],
    reporter: 'verbose',
  },
});

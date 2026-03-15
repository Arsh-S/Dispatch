/**
 * Vitest configuration for integration tests.
 *
 * These tests make REAL calls to the Claude CLI — they are slow, cost money,
 * and require `claude` to be authenticated. They must never run during
 * a normal `vitest run`.
 *
 * Run explicitly with:
 *   pnpm vitest run --config vitest.integration.config.ts
 *
 * Or with a single file:
 *   pnpm vitest run --config vitest.integration.config.ts src/__integration_tests__/claude-agent-runner.integration.test.ts
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Match only files inside __integration_tests__ so a normal `vitest run`
    // (which uses the default include pattern) never picks these up.
    include: ['src/__integration_tests__/**/*.integration.test.ts'],

    // Exclude everything else
    exclude: ['node_modules', 'dist'],

    // Global test timeout: 3 minutes — Claude CLI calls are slow.
    // Individual tests can override with test.timeout().
    testTimeout: 180_000,
    hookTimeout: 60_000,

    // Run serially to avoid spawning many claude subprocesses in parallel,
    // which burns API credits and can confuse rate-limit counters.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Always print stdout so the actual Claude responses appear in test output.
    reporter: 'verbose',
  },
});

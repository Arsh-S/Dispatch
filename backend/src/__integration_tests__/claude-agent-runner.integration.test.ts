/**
 * Integration tests for runClaudeAgent() — REAL Claude API calls, no mocks.
 *
 * Run with:
 *   pnpm vitest run --config vitest.integration.config.ts
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { z } from 'zod';
import { runClaudeAgent } from '../agent-adapters/claude-agent-runner';

function claudeReady(): boolean {
  try {
    execSync('claude --version', { stdio: 'pipe', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

const CLAUDE_READY = claudeReady();
const maybeIt = CLAUDE_READY ? it : it.skip;

describe('runClaudeAgent — real API integration', () => {
  /**
   * Test 1: Basic round-trip — can we call Claude and get valid JSON back
   * that parses against a Zod schema?
   */
  maybeIt(
    'returns parsed JSON matching the Zod schema',
    async () => {
      const schema = z.object({
        name: z.string(),
        count: z.number(),
        tag: z.string().default('unset'),
      });

      const result = await runClaudeAgent({
        systemPrompt: 'You are a JSON generator. Return ONLY valid JSON, no prose.',
        taskPrompt:
          'Return a JSON object with exactly these fields:\n' +
          '  - "name": the string "integration-test"\n' +
          '  - "count": the number 42',
        outputSchema: schema,
        timeoutMs: 60_000,
      });

      console.log('[test 1] raw:', result.rawOutput?.slice(0, 300));
      expect(result.success, `Agent failed: ${result.error}`).toBe(true);
      expect(result.data!.name).toBe('integration-test');
      expect(result.data!.count).toBe(42);
      expect(typeof result.data!.tag).toBe('string'); // default kicked in
    },
    90_000,
  );

  /**
   * Test 2: Zod .default() fills missing fields — prove the schema contract
   * works end-to-end when Claude omits optional fields.
   */
  maybeIt(
    'fills Zod .default() values when Claude omits fields',
    async () => {
      const schema = z.object({
        title: z.string(),
        score: z.number().default(0),
        labels: z.array(z.string()).default([]),
        ready: z.boolean().default(false),
      });

      const result = await runClaudeAgent({
        systemPrompt: 'Return ONLY the fields explicitly asked for. No extras.',
        taskPrompt:
          'Return a JSON object with ONLY one field:\n' +
          '  - "title": the string "defaults-test"\n' +
          'Do NOT include score, labels, or ready.',
        outputSchema: schema,
        timeoutMs: 60_000,
      });

      console.log('[test 2] raw:', result.rawOutput?.slice(0, 300));
      expect(result.success, `Agent failed: ${result.error}`).toBe(true);
      expect(result.data!.title).toBe('defaults-test');
      expect(result.data!.score).toBe(0);
      expect(result.data!.labels).toEqual([]);
      expect(result.data!.ready).toBe(false);
    },
    90_000,
  );

  /**
   * Test 3: Complex nested schema with enums — proves Claude respects
   * enum constraints and nested object structure from the JSON schema.
   */
  maybeIt(
    'handles nested objects with enum constraints',
    async () => {
      const schema = z.object({
        finding: z.object({
          severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
          vuln_type: z.string(),
          location: z.object({
            file: z.string(),
            line: z.number(),
            endpoint: z.string(),
          }),
        }),
        status: z.enum(['completed', 'timeout', 'worker_error']).default('completed'),
      });

      const result = await runClaudeAgent({
        systemPrompt: 'You are a security report generator. Return ONLY valid JSON.',
        taskPrompt:
          'Return a JSON object representing a security finding:\n' +
          '  - finding.severity: "HIGH"\n' +
          '  - finding.vuln_type: "SQL Injection"\n' +
          '  - finding.location.file: "src/routes/users.ts"\n' +
          '  - finding.location.line: 42\n' +
          '  - finding.location.endpoint: "/api/users"',
        outputSchema: schema,
        timeoutMs: 60_000,
      });

      console.log('[test 3] raw:', result.rawOutput?.slice(0, 300));
      expect(result.success, `Agent failed: ${result.error}`).toBe(true);
      expect(result.data!.finding.severity).toBe('HIGH');
      expect(result.data!.finding.vuln_type).toBe('SQL Injection');
      expect(result.data!.finding.location.file).toBe('src/routes/users.ts');
      expect(result.data!.finding.location.line).toBe(42);
      expect(['completed', 'timeout', 'worker_error']).toContain(result.data!.status);
    },
    90_000,
  );
});

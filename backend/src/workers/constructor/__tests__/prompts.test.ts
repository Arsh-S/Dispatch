import { describe, it, expect } from 'vitest';
import { CONSTRUCTOR_SYSTEM_PROMPT, buildConstructorTaskPrompt } from '../prompts';
import type { ParsedIssue, ConstructorBootstrap } from '../types';

const mockParsed: ParsedIssue = {
  dispatch_run_id: 'run-test-001',
  dispatch_worker_id: 'worker-abc',
  severity: 'HIGH',
  cvss_score: 8.1,
  owasp: 'A03:2021',
  vuln_type: 'sql-injection',
  exploit_confidence: 'confirmed',
  monkeypatch_status: 'validated',
  fix_status: 'pending',
  location: {
    file: 'src/routes/orders.ts',
    line: 42,
    endpoint: '/api/orders/:id',
    method: 'GET',
    parameter: 'id',
  },
  description: 'SQL injection via template literal in query builder',
  reproduction_command: "curl -X GET http://localhost:3000/api/orders/1' OR '1'='1",
  monkeypatch_diff: "- db.prepare(`SELECT * FROM orders WHERE id = ${id}`)\n+ db.prepare('SELECT * FROM orders WHERE id = ?').get(id)",
  recommended_fix: 'Use parameterized queries',
  rules_violated: ['No raw SQL'],
};

const mockBootstrap: ConstructorBootstrap = {
  construction_worker_id: 'ctor-001',
  triggered_at: '2026-03-14T00:00:00.000Z',
  triggered_by: 'slack',
  timeout_seconds: 300,
  github_issue: { repo: 'owner/repo', number: 42 },
  github_repo: 'owner/repo',
  app_config: {
    runtime: 'node',
    install: 'npm install',
    start: 'node server.js',
    port: 3000,
  },
  pr_config: {
    base_branch: 'main',
    branch_prefix: 'fix/',
  },
};

describe('CONSTRUCTOR_SYSTEM_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof CONSTRUCTOR_SYSTEM_PROMPT).toBe('string');
    expect(CONSTRUCTOR_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('should describe the remediation engineer role', () => {
    expect(CONSTRUCTOR_SYSTEM_PROMPT.toLowerCase()).toContain('security');
  });

  it('should mention minimal fix approach', () => {
    expect(CONSTRUCTOR_SYSTEM_PROMPT.toLowerCase()).toContain('minimal');
  });

  it('should mention JSON output requirement', () => {
    expect(CONSTRUCTOR_SYSTEM_PROMPT).toContain('JSON');
  });
});

describe('buildConstructorTaskPrompt', () => {
  it('should include the vulnerability type', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('sql-injection');
  });

  it('should include the file path', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('src/routes/orders.ts');
  });

  it('should include the line number', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('42');
  });

  it('should include the endpoint', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('/api/orders/:id');
  });

  it('should include the severity', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('HIGH');
  });

  it('should include the description', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('SQL injection via template literal');
  });

  it('should include the recommended fix', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('parameterized queries');
  });

  it('should include the monkeypatch diff when present', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('Monkeypatch Diff');
    expect(prompt).toContain('prepare(');
  });

  it('should include the reproduction command when present', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('Reproduction Command');
    expect(prompt).toContain('curl');
  });

  it('should include the GitHub repo', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('owner/repo');
  });

  it('should include the base branch', () => {
    const prompt = buildConstructorTaskPrompt(mockParsed, mockBootstrap);
    expect(prompt).toContain('main');
  });

  it('should handle missing optional fields gracefully', () => {
    const parsedWithoutOptionals: ParsedIssue = {
      ...mockParsed,
      cvss_score: undefined,
      owasp: undefined,
      reproduction_command: undefined,
      monkeypatch_diff: undefined,
      location: { ...mockParsed.location, parameter: undefined },
    };

    const prompt = buildConstructorTaskPrompt(parsedWithoutOptionals, mockBootstrap);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    // Should not have undefined in the output
    expect(prompt).not.toContain('undefined');
  });
});

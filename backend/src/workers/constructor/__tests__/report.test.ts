import { describe, it, expect } from 'vitest';
import { formatFixReport } from '../report.js';
import { ConstructorBootstrap, FixResult } from '../types.js';

const bootstrap: ConstructorBootstrap = {
  construction_worker_id: 'cw-test-1',
  triggered_at: new Date(Date.now() - 30000).toISOString(), // 30s ago
  triggered_by: 'github',
  timeout_seconds: 300,
  github_issue: { repo: 'test-org/test-repo', number: 42 },
  app_config: { runtime: 'node', install: 'npm install', start: 'npm start', port: 3000 },
  pr_config: { base_branch: 'main', branch_prefix: 'dispatch/fix' },
};

describe('formatFixReport', () => {
  it('should include status and worker id', () => {
    const fixResult: FixResult = {
      status: 'fix_verified',
      files_changed: ['src/routes/orders.js'],
      validation: { result: 'PASS', response: 'Fix applied' },
      notes: 'Applied SQL injection fix',
    };
    const report = formatFixReport(bootstrap, fixResult);
    expect(report).toContain('fix_verified');
    expect(report).toContain('cw-test-1');
  });

  it('should include PR info when present', () => {
    const fixResult: FixResult = {
      status: 'fix_verified',
      files_changed: ['src/routes/orders.js'],
      pr: { number: 99, url: 'https://github.com/test/repo/pull/99', branch: 'dispatch/fix-sql-1' },
      notes: 'Fixed',
    };
    const report = formatFixReport(bootstrap, fixResult);
    expect(report).toContain('#99');
    expect(report).toContain('dispatch/fix-sql-1');
  });

  it('should show "No PR Created" when no PR', () => {
    const fixResult: FixResult = {
      status: 'fix_failed',
      files_changed: [],
      notes: 'Could not fix',
    };
    const report = formatFixReport(bootstrap, fixResult);
    expect(report).toContain('No PR Created');
    expect(report).toContain('No files were modified');
  });

  it('should include changed files list', () => {
    const fixResult: FixResult = {
      status: 'fix_verified',
      files_changed: ['src/a.js', 'src/b.js'],
      notes: 'Multiple files fixed',
    };
    const report = formatFixReport(bootstrap, fixResult);
    expect(report).toContain('`src/a.js`');
    expect(report).toContain('`src/b.js`');
  });

  it('should include validation results when present', () => {
    const fixResult: FixResult = {
      status: 'fix_verified',
      files_changed: ['src/a.js'],
      validation: { result: 'PASS', response: 'Exploit no longer works' },
      notes: 'Done',
    };
    const report = formatFixReport(bootstrap, fixResult);
    expect(report).toContain('PASS');
    expect(report).toContain('Exploit no longer works');
  });
});

import { describe, it, expect } from 'vitest';
import { formatTitle, formatBody, getLabels } from '../issues.js';
import { FindingForIssue } from '../types.js';

function makeFinding(overrides: Partial<FindingForIssue> = {}): FindingForIssue {
  return {
    dispatch_run_id: 'dispatch-run-abc123',
    dispatch_worker_id: 'worker-1',
    timestamp: '2026-03-14T12:00:00Z',
    severity: 'HIGH',
    cvss_score: 8.1,
    owasp: 'A03:2021',
    vuln_type: 'sql-injection',
    exploit_confidence: 'confirmed',
    monkeypatch_status: 'validated',
    fix_status: 'unfixed',
    location: {
      file: 'src/routes/users.ts',
      line: 42,
      endpoint: '/api/users',
      method: 'GET',
      parameter: 'id',
    },
    description: 'SQL injection via unsanitized user input in query parameter. This allows arbitrary database access.',
    reproduction: {
      steps: ['Navigate to /api/users', 'Add malicious id parameter'],
      command: "curl 'http://localhost:3000/api/users?id=1%27%20OR%201=1'",
      expected: 'Returns 400 or sanitized response',
      actual: 'Returns all user records from database',
    },
    server_logs: [
      { timestamp: '2026-03-14T12:00:01Z', level: 'ERROR', message: 'Unhandled SQL query error' },
    ],
    monkeypatch: {
      status: 'validated',
      diff: '- const query = `SELECT * FROM users WHERE id = ${id}`;\n+ const query = `SELECT * FROM users WHERE id = ?`;',
      validation: {
        test: 'SQL injection attempt returns 400',
        result: 'pass',
        response: '400 Bad Request',
      },
    },
    recommended_fix: 'Use parameterized queries instead of string interpolation for all SQL statements.',
    rules_violated: ['no-raw-sql', 'input-validation-required'],
    ...overrides,
  };
}

describe('issues', () => {
  describe('formatTitle', () => {
    it('should include severity, vuln type, endpoint, and description', () => {
      const finding = makeFinding();
      const title = formatTitle(finding);
      expect(title).toContain('[HIGH]');
      expect(title).toContain('Sql Injection');
      expect(title).toContain('GET /api/users');
    });

    it('should capitalize hyphenated vuln types', () => {
      const finding = makeFinding({ vuln_type: 'cross-site-scripting' });
      const title = formatTitle(finding);
      expect(title).toContain('Cross Site Scripting');
    });

    it('should truncate long descriptions to 60 chars', () => {
      const finding = makeFinding({
        description: 'A very long description that exceeds sixty characters and should be truncated at the boundary point for readability.',
      });
      const title = formatTitle(finding);
      // The first sentence before the period is used, then truncated if > 60
      const descPart = title.split(' — ')[1];
      expect(descPart.length).toBeLessThanOrEqual(63); // 60 + "..."
    });

    it('should use the first sentence of description', () => {
      const finding = makeFinding({
        description: 'Short desc. Second sentence ignored.',
      });
      const title = formatTitle(finding);
      expect(title).toContain('Short desc');
      expect(title).not.toContain('Second sentence');
    });
  });

  describe('formatBody', () => {
    it('should include metadata frontmatter', () => {
      const finding = makeFinding();
      const body = formatBody(finding);
      expect(body).toContain('dispatch_run_id: dispatch-run-abc123');
      expect(body).toContain('severity: HIGH');
      expect(body).toContain('cvss_score: 8.1');
    });

    it('should include vulnerability location table', () => {
      const finding = makeFinding();
      const body = formatBody(finding);
      expect(body).toContain('`src/routes/users.ts`');
      expect(body).toContain('42');
      expect(body).toContain('`/api/users`');
      expect(body).toContain('GET');
      expect(body).toContain('`id`');
    });

    it('should include reproduction steps when present', () => {
      const finding = makeFinding();
      const body = formatBody(finding);
      expect(body).toContain('## Reproduction');
      expect(body).toContain('1. Navigate to /api/users');
      expect(body).toContain('2. Add malicious id parameter');
      expect(body).toContain("curl 'http://localhost:3000/api/users?id=1%27%20OR%201=1'");
    });

    it('should omit reproduction section when not present', () => {
      const finding = makeFinding({ reproduction: null });
      const body = formatBody(finding);
      expect(body).not.toContain('## Reproduction');
    });

    it('should include server logs when present', () => {
      const finding = makeFinding();
      const body = formatBody(finding);
      expect(body).toContain('## Server Logs');
      expect(body).toContain('Unhandled SQL query error');
    });

    it('should omit server logs when empty', () => {
      const finding = makeFinding({ server_logs: [] });
      const body = formatBody(finding);
      expect(body).not.toContain('## Server Logs');
    });

    it('should include monkeypatch diff and validation', () => {
      const finding = makeFinding();
      const body = formatBody(finding);
      expect(body).toContain('## Monkeypatch');
      expect(body).toContain('```diff');
      expect(body).toContain('### Validation');
      expect(body).toContain('pass');
    });

    it('should include recommended fix', () => {
      const finding = makeFinding();
      const body = formatBody(finding);
      expect(body).toContain('## Recommended Fix');
      expect(body).toContain('parameterized queries');
    });

    it('should include rules violated', () => {
      const finding = makeFinding();
      const body = formatBody(finding);
      expect(body).toContain('## RULES.md Violations');
      expect(body).toContain('`no-raw-sql`');
      expect(body).toContain('`input-validation-required`');
    });

    it('should omit rules section when empty', () => {
      const finding = makeFinding({ rules_violated: [] });
      const body = formatBody(finding);
      expect(body).not.toContain('## RULES.md Violations');
    });

    it('should omit optional fields from metadata when undefined', () => {
      const finding = makeFinding({ cvss_score: undefined, owasp: undefined });
      const body = formatBody(finding);
      expect(body).not.toContain('cvss_score:');
      expect(body).not.toContain('owasp:');
    });

    it('should omit parameter row when null', () => {
      const finding = makeFinding({ location: { file: 'a.ts', line: 1, endpoint: '/x', method: 'POST', parameter: null } });
      const body = formatBody(finding);
      expect(body).not.toContain('Affected Parameter');
    });
  });

  describe('getLabels', () => {
    it('should always include dispatch label', () => {
      const labels = getLabels(makeFinding());
      expect(labels).toContain('dispatch');
    });

    it('should include exploit confidence label', () => {
      const labels = getLabels(makeFinding({ exploit_confidence: 'confirmed' }));
      expect(labels).toContain('exploit:confirmed');
    });

    it('should include monkeypatch status label', () => {
      const labels = getLabels(makeFinding({ monkeypatch_status: 'failed' }));
      expect(labels).toContain('monkeypatch:failed');
    });

    it('should include fix status label', () => {
      const labels = getLabels(makeFinding({ fix_status: 'verified' }));
      expect(labels).toContain('fix:verified');
    });

    it('should default fix status to unfixed when empty', () => {
      const labels = getLabels(makeFinding({ fix_status: '' }));
      expect(labels).toContain('fix:unfixed');
    });

    it('should include severity label in lowercase', () => {
      const labels = getLabels(makeFinding({ severity: 'CRITICAL' }));
      expect(labels).toContain('severity:critical');
    });

    it('should include vuln type label', () => {
      const labels = getLabels(makeFinding({ vuln_type: 'sql-injection' }));
      expect(labels).toContain('vuln:sql-injection');
    });

    it('should include owasp label when present', () => {
      const labels = getLabels(makeFinding({ owasp: 'A03:2021' }));
      expect(labels).toContain('owasp:A03-2021');
    });

    it('should omit owasp label when not present', () => {
      const labels = getLabels(makeFinding({ owasp: undefined }));
      const owaspLabels = labels.filter(l => l.startsWith('owasp:'));
      expect(owaspLabels).toHaveLength(0);
    });

    it('should include dispatch run and worker labels', () => {
      const labels = getLabels(makeFinding({
        dispatch_run_id: 'dispatch-run-xyz',
        dispatch_worker_id: 'worker-5',
      }));
      expect(labels).toContain('dispatch-run:xyz');
      expect(labels).toContain('dispatch-worker:worker-5');
    });

    it('should handle run IDs without the dispatch-run- prefix gracefully', () => {
      const labels = getLabels(makeFinding({ dispatch_run_id: 'custom-id' }));
      expect(labels).toContain('dispatch-run:custom-id');
    });
  });
});

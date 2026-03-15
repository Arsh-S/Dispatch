#!/usr/bin/env tsx
/**
 * Simulates an agent report submission to the backend.
 * POSTs a sample finding to /api/report and creates a Linear issue.
 *
 * Usage:
 *   pnpm report:linear
 *   # or with API base URL:
 *   API_URL=http://localhost:3333 pnpm report:linear
 */

import type { FindingForIssue } from '../src/github/types.js';

const API_URL = process.env.API_URL || 'http://localhost:3333';

const SAMPLE_FINDING: FindingForIssue = {
  dispatch_run_id: `test-run-${Date.now()}`,
  dispatch_worker_id: 'agent-pentester-1',
  timestamp: new Date().toISOString(),
  severity: 'HIGH',
  cvss_score: 7.5,
  owasp: 'A03:2021-Injection',
  vuln_type: 'sql-injection',
  exploit_confidence: 'confirmed',
  monkeypatch_status: 'not-attempted',
  fix_status: 'unfixed',
  location: {
    file: 'src/routes/users.ts',
    line: 42,
    endpoint: '/api/users',
    method: 'GET',
    parameter: 'id',
  },
  description:
    'User-supplied input in the `id` parameter is concatenated into a SQL query without sanitization, allowing SQL injection. An attacker can extract or modify database records.',
  reproduction: {
    steps: ['Navigate to /api/users', 'Append ?id=1 OR 1=1 to the URL'],
    command: 'curl "http://localhost:3000/api/users?id=1%20OR%201=1"',
    expected: 'Single user record or 404',
    actual: 'Returns all users due to SQL injection',
  },
  recommended_fix: 'Use parameterized queries or an ORM. Never concatenate user input into SQL.',
  rules_violated: ['CWE-89: SQL Injection', 'OWASP A03:2021'],
};

async function main() {
  console.log(`[Report] Submitting agent report to ${API_URL}/api/report...`);

  const res = await fetch(`${API_URL}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ findings: [SAMPLE_FINDING] }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`[Report] Failed: ${res.status}`, data);
    process.exit(1);
  }

  console.log(`[Report] Success! Created ${data.created} Linear issue(s):`);
  for (const issue of data.issues || []) {
    console.log(`  ${issue.identifier}: ${issue.title}`);
    console.log(`  → ${issue.url}`);
  }
}

main().catch((err) => {
  console.error('[Report] Error:', err.message);
  process.exit(1);
});

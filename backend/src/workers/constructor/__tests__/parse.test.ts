import { describe, it, expect } from 'vitest';
import { parseIssueBody } from '../parse.js';

// Full issue body matching the schema in docs/github-issue-schema.md
const FULL_ISSUE_BODY = `---
dispatch_run_id: dispatch-run-a3f8c
dispatch_worker_id: worker-injection-orders-7x2
timestamp: 2026-03-14T18:32:00Z
severity: HIGH
cvss_score: 8.1
owasp: A03:2021 Injection
vuln_type: SQL Injection
exploit_confidence: confirmed
monkeypatch_status: validated
fix_status: unfixed
---

## Vulnerability

| Field | Value |
|---|---|
| **File** | \`src/routes/orders.js\` |
| **Line** | 47 |
| **Endpoint** | \`POST /api/orders\` |
| **Method** | POST |
| **Affected Parameter** | \`order_id\` (request body) |

**Description:**
The order_id parameter is interpolated directly into a SQL query via string concatenation on line 47. An attacker can inject arbitrary SQL.

---

### Reproduction

\`\`\`bash
curl -X POST http://localhost:3000/api/orders \\
  -H "Content-Type: application/json" \\
  -d '{"order_id": "1; DROP TABLE orders;--"}'
\`\`\`

---

### Monkeypatch

\`\`\`diff
--- a/src/routes/orders.js
+++ b/src/routes/orders.js
@@ -45,3 +45,3 @@
-  const result = await db.query(\`SELECT * FROM orders WHERE id = '\${req.body.order_id}'\`);
+  const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.body.order_id]);
\`\`\`

---

## Recommended Fix

Refactor the raw SQL query to use the existing knex query builder. Also check src/routes/products.js:61 which uses the same pattern.

---

## RULES.md Violations

- \`No raw SQL queries — must use parameterized statements\`
- \`Payment endpoints are critical priority\`

---`;

describe('parseIssueBody', () => {
  it('should parse frontmatter metadata', () => {
    const result = parseIssueBody(FULL_ISSUE_BODY);
    expect(result.dispatch_run_id).toBe('dispatch-run-a3f8c');
    expect(result.dispatch_worker_id).toBe('worker-injection-orders-7x2');
    expect(result.severity).toBe('HIGH');
    expect(result.cvss_score).toBe(8.1);
    expect(result.owasp).toBe('A03:2021 Injection');
    expect(result.vuln_type).toBe('SQL Injection');
    expect(result.exploit_confidence).toBe('confirmed');
    expect(result.monkeypatch_status).toBe('validated');
    expect(result.fix_status).toBe('unfixed');
  });

  it('should parse location table', () => {
    const result = parseIssueBody(FULL_ISSUE_BODY);
    expect(result.location.file).toBe('src/routes/orders.js');
    expect(result.location.line).toBe(47);
    expect(result.location.endpoint).toBe('POST /api/orders');
    expect(result.location.method).toBe('POST');
    expect(result.location.parameter).toBe('order_id');
  });

  it('should parse description section', () => {
    const result = parseIssueBody(FULL_ISSUE_BODY);
    expect(result.description).toContain('order_id parameter is interpolated directly');
  });

  it('should parse reproduction command from bash code block', () => {
    const result = parseIssueBody(FULL_ISSUE_BODY);
    expect(result.reproduction_command).toBeDefined();
    expect(result.reproduction_command).toContain('curl -X POST');
    expect(result.reproduction_command).toContain('DROP TABLE');
  });

  it('should parse monkeypatch diff from diff code block', () => {
    const result = parseIssueBody(FULL_ISSUE_BODY);
    expect(result.monkeypatch_diff).toBeDefined();
    expect(result.monkeypatch_diff).toContain('--- a/src/routes/orders.js');
    expect(result.monkeypatch_diff).toContain('+++ b/src/routes/orders.js');
  });

  it('should parse recommended fix section', () => {
    const result = parseIssueBody(FULL_ISSUE_BODY);
    expect(result.recommended_fix).toContain('knex query builder');
  });

  it('should parse rules violated', () => {
    const result = parseIssueBody(FULL_ISSUE_BODY);
    expect(result.rules_violated).toHaveLength(2);
    expect(result.rules_violated[0]).toContain('No raw SQL queries');
    expect(result.rules_violated[1]).toContain('Payment endpoints are critical priority');
  });

  it('should handle missing frontmatter gracefully', () => {
    const body = `## Vulnerability

| Field | Value |
|---|---|
| **File** | \`src/app.js\` |
| **Line** | 10 |
| **Endpoint** | \`GET /api/test\` |
| **Method** | GET |`;

    const result = parseIssueBody(body);
    expect(result.dispatch_run_id).toBe('');
    expect(result.severity).toBe('MEDIUM');
    expect(result.exploit_confidence).toBe('unconfirmed');
    expect(result.monkeypatch_status).toBe('not-attempted');
    expect(result.location.file).toBe('src/app.js');
    expect(result.location.line).toBe(10);
  });

  it('should handle missing optional fields', () => {
    const body = `---
dispatch_run_id: run-1
dispatch_worker_id: worker-1
severity: LOW
vuln_type: xss
exploit_confidence: unconfirmed
monkeypatch_status: not-attempted
fix_status: unfixed
---

Some body without tables or code blocks.`;

    const result = parseIssueBody(body);
    expect(result.cvss_score).toBeUndefined();
    expect(result.owasp).toBeUndefined();
    expect(result.reproduction_command).toBeUndefined();
    expect(result.monkeypatch_diff).toBeUndefined();
    expect(result.location.file).toBe('');
    expect(result.location.parameter).toBeUndefined();
    expect(result.rules_violated).toEqual([]);
  });

  it('should handle empty body', () => {
    const result = parseIssueBody('');
    expect(result.dispatch_run_id).toBe('');
    expect(result.vuln_type).toBe('');
    expect(result.severity).toBe('MEDIUM');
    expect(result.location.file).toBe('');
    expect(result.location.line).toBe(0);
  });

  it('should parse parameter field that includes extra context in parens', () => {
    const body = `| **Affected Parameter** | \`user_id\` (query string) |`;
    const result = parseIssueBody(body);
    expect(result.location.parameter).toBe('user_id');
  });
});

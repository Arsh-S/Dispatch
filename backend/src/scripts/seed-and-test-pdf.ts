/**
 * Seed data and test the PDF report generator
 * Run with: pnpm tsx src/scripts/seed-and-test-pdf.ts
 */

import { generatePdfReport, type PdfReportOptions } from '../reporting/pdf';
import type { MergedReport } from '../orchestrator/collector';
import type { Finding, CleanEndpoint } from '../schemas/finding-report';
import path from 'path';

// Sample findings covering all severity levels
const sampleFindings: Finding[] = [
  {
    finding_id: 'finding-sqli-001',
    severity: 'CRITICAL',
    cvss_score: 9.8,
    owasp: 'A03:2021 Injection',
    vuln_type: 'sql-injection',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/routes/users.ts',
      line: 42,
      endpoint: '/api/users',
      method: 'GET',
      parameter: 'id',
    },
    description: 'SQL injection vulnerability in user ID parameter. Attacker can extract all user data including passwords by manipulating the id parameter. The query is built using string concatenation without parameterization.',
    reproduction: {
      command: `curl -X GET "http://localhost:3000/api/users?id=1' OR '1'='1"`,
      expected: '401 Unauthorized or single user record',
      actual: '200 OK with all user records including password hashes',
    },
    monkeypatch: {
      status: 'validated',
      diff: `--- a/src/routes/users.ts
+++ b/src/routes/users.ts
@@ -40,3 +40,4 @@
-  const query = \`SELECT * FROM users WHERE id = \${id}\`;
-  const result = db.exec(query);
+  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
+  const result = stmt.get(id);`,
      validation: {
        test: 'Replayed SQL injection payload after patch',
        result: 'PASS',
        response: '400 Bad Request - Invalid ID format',
      },
    },
    recommended_fix: 'Use parameterized queries (prepared statements) instead of string concatenation. Never trust user input directly in SQL queries.',
    rules_violated: ['RULE-001: Always use parameterized queries', 'RULE-002: Validate input types'],
    server_logs: [],
  },
  {
    finding_id: 'finding-xss-001',
    severity: 'HIGH',
    cvss_score: 7.5,
    owasp: 'A03:2021 Injection',
    vuln_type: 'cross-site-scripting',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/routes/comments.ts',
      line: 28,
      endpoint: '/api/comments',
      method: 'POST',
      parameter: 'content',
    },
    description: 'Stored XSS vulnerability in comment content field. User-supplied HTML/JavaScript is rendered without sanitization, allowing attackers to execute arbitrary scripts in victims\' browsers.',
    reproduction: {
      command: `curl -X POST "http://localhost:3000/api/comments" -H "Content-Type: application/json" -d '{"content": "<script>alert(document.cookie)</script>"}'`,
      expected: 'Comment rejected or HTML escaped',
      actual: 'Comment stored with raw HTML, executes on page load',
    },
    monkeypatch: {
      status: 'validated',
      diff: `--- a/src/routes/comments.ts
+++ b/src/routes/comments.ts
@@ -26,2 +26,3 @@
-  const sanitized = content;
+  import DOMPurify from 'dompurify';
+  const sanitized = DOMPurify.sanitize(content);`,
      validation: {
        test: 'Replayed XSS payload after patch',
        result: 'PASS',
        response: 'Script tags stripped from output',
      },
    },
    recommended_fix: 'Sanitize all user input before storing or rendering. Use a library like DOMPurify or encode HTML entities.',
    rules_violated: ['RULE-003: Sanitize user input', 'RULE-004: Encode output'],
    server_logs: [],
  },
  {
    finding_id: 'finding-auth-001',
    severity: 'HIGH',
    cvss_score: 8.1,
    owasp: 'A01:2021 Broken Access Control',
    vuln_type: 'broken-access-control',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/routes/orders.ts',
      line: 67,
      endpoint: '/api/orders/:id',
      method: 'GET',
      parameter: 'id',
    },
    description: 'IDOR vulnerability allows authenticated users to access orders belonging to other users. No ownership check is performed before returning order details.',
    reproduction: {
      command: `curl -X GET "http://localhost:3000/api/orders/999" -H "Authorization: Bearer <user_a_token>"`,
      expected: '403 Forbidden - Order belongs to different user',
      actual: '200 OK with order details for user B',
    },
    monkeypatch: {
      status: 'validated',
      diff: `--- a/src/routes/orders.ts
+++ b/src/routes/orders.ts
@@ -65,3 +65,6 @@
   const order = await getOrderById(id);
+  if (order.userId !== req.user.id) {
+    return res.status(403).json({ error: 'Forbidden' });
+  }
   return res.json(order);`,
      validation: {
        test: 'Attempted to access another user order after patch',
        result: 'PASS',
        response: '403 Forbidden',
      },
    },
    recommended_fix: 'Always verify resource ownership before returning data. Implement proper access control checks.',
    rules_violated: ['RULE-005: Verify resource ownership'],
    server_logs: [],
  },
  {
    finding_id: 'finding-info-001',
    severity: 'MEDIUM',
    cvss_score: 5.3,
    owasp: 'A05:2021 Security Misconfiguration',
    vuln_type: 'information-disclosure',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/middleware/error-handler.ts',
      line: 15,
      endpoint: '/api/*',
      method: 'ALL',
      parameter: null,
    },
    description: 'Stack traces and internal error details are exposed in production error responses, revealing internal implementation details and potentially sensitive paths.',
    reproduction: {
      command: `curl -X GET "http://localhost:3000/api/nonexistent"`,
      expected: 'Generic error message',
      actual: 'Full stack trace with file paths and line numbers',
    },
    monkeypatch: {
      status: 'not-attempted',
      diff: null,
    },
    recommended_fix: 'Disable detailed error messages in production. Log errors server-side but return generic messages to clients.',
    rules_violated: ['RULE-006: Hide stack traces in production'],
    server_logs: [],
  },
  {
    finding_id: 'finding-headers-001',
    severity: 'LOW',
    cvss_score: 3.1,
    owasp: 'A05:2021 Security Misconfiguration',
    vuln_type: 'missing-security-headers',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/app.ts',
      line: 12,
      endpoint: '/*',
      method: 'ALL',
      parameter: null,
    },
    description: 'Missing security headers: X-Content-Type-Options, X-Frame-Options, and Content-Security-Policy. This may allow clickjacking and MIME sniffing attacks.',
    reproduction: {
      command: `curl -I "http://localhost:3000/"`,
      expected: 'Security headers present',
      actual: 'No X-Frame-Options, no CSP, no X-Content-Type-Options',
    },
    monkeypatch: {
      status: 'not-attempted',
      diff: null,
    },
    recommended_fix: 'Use helmet.js or manually set security headers: X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Content-Security-Policy.',
    rules_violated: ['RULE-007: Set security headers'],
    server_logs: [],
  },
  {
    finding_id: 'finding-rate-001',
    severity: 'LOW',
    cvss_score: 2.7,
    owasp: 'A07:2021 Identification and Authentication Failures',
    vuln_type: 'rate-limiting',
    exploit_confidence: 'unconfirmed',
    location: {
      file: 'src/routes/auth.ts',
      line: 45,
      endpoint: '/api/auth/login',
      method: 'POST',
      parameter: null,
    },
    description: 'No rate limiting on login endpoint. Attackers could perform brute force attacks against user accounts without being blocked.',
    reproduction: {
      command: `for i in {1..100}; do curl -X POST "http://localhost:3000/api/auth/login" -d '{"email":"admin@example.com","password":"guess'$i'"}'; done`,
      expected: 'Requests blocked after threshold',
      actual: 'All 100 requests processed without rate limiting',
    },
    monkeypatch: {
      status: 'not-attempted',
      diff: null,
    },
    recommended_fix: 'Implement rate limiting using express-rate-limit or similar. Consider progressive delays and account lockout after failed attempts.',
    rules_violated: ['RULE-008: Rate limit authentication endpoints'],
    server_logs: [],
  },
];

// Sample clean endpoints
const sampleCleanEndpoints: CleanEndpoint[] = [
  {
    endpoint: '/api/health',
    parameter: 'none',
    attack_type: 'sql-injection',
    notes: 'No database queries, static response',
  },
  {
    endpoint: '/api/health',
    parameter: 'none',
    attack_type: 'xss',
    notes: 'No user input reflection',
  },
  {
    endpoint: '/api/version',
    parameter: 'none',
    attack_type: 'sql-injection',
    notes: 'Static response, no injection points',
  },
  {
    endpoint: '/api/docs',
    parameter: 'none',
    attack_type: 'all',
    notes: 'Static documentation endpoint',
  },
];

// Build the merged report
const sampleReport: MergedReport = {
  dispatch_run_id: `dispatch-${Date.now().toString(36)}`,
  completed_at: new Date().toISOString(),
  duration_seconds: 127,
  total_workers: 4,
  findings: sampleFindings,
  clean_endpoints: sampleCleanEndpoints,
  worker_errors: [
    {
      worker_id: 'worker-3',
      error: 'Connection timeout after 30s - target endpoint /api/slow unresponsive',
      retryable: true,
    },
  ],
  summary: {
    critical: sampleFindings.filter(f => f.severity === 'CRITICAL').length,
    high: sampleFindings.filter(f => f.severity === 'HIGH').length,
    medium: sampleFindings.filter(f => f.severity === 'MEDIUM').length,
    low: sampleFindings.filter(f => f.severity === 'LOW').length,
    total_endpoints: 10,
    vulnerable_endpoints: 6,
    clean_endpoints: 4,
  },
};

async function main() {
  const outputPath = path.resolve(__dirname, '../../test-report.pdf');

  console.log('Generating PDF report with sample data...');
  console.log(`  Run ID: ${sampleReport.dispatch_run_id}`);
  console.log(`  Findings: ${sampleReport.findings.length}`);
  console.log(`    - Critical: ${sampleReport.summary.critical}`);
  console.log(`    - High: ${sampleReport.summary.high}`);
  console.log(`    - Medium: ${sampleReport.summary.medium}`);
  console.log(`    - Low: ${sampleReport.summary.low}`);
  console.log(`  Clean endpoints: ${sampleReport.clean_endpoints.length}`);
  console.log(`  Worker errors: ${sampleReport.worker_errors.length}`);
  console.log('');

  const options: PdfReportOptions = {
    githubRepo: 'dispatch-security/sample-app',
    githubRef: 'main',
    createdIssues: new Map([
      ['finding-sqli-001', { number: 1, url: 'https://github.com/dispatch-security/sample-app/issues/1' }],
      ['finding-xss-001', { number: 2, url: 'https://github.com/dispatch-security/sample-app/issues/2' }],
      ['finding-auth-001', { number: 3, url: 'https://github.com/dispatch-security/sample-app/issues/3' }],
    ]),
  };

  try {
    await generatePdfReport(sampleReport, outputPath, options);
    console.log(`PDF report generated: ${outputPath}`);
    console.log('');
    console.log('Open it with:');
    console.log(`  open "${outputPath}"`);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    process.exit(1);
  }
}

main();

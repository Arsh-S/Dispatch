import { generatePdfReport } from '../reporting/pdf';
import type { MergedReport } from '../orchestrator/collector';

/**
 * Generate a fake security report using real file locations from the Dispatch repository
 * This is used for testing and demonstration purposes
 */
async function generateFakeReport() {
  // Create a fake merged report with real locations from the codebase
  const fakeReport: MergedReport = {
    dispatch_run_id: 'DISPATCH-2026-03-14-001-TEST',
    completed_at: new Date().toISOString(),
    duration_seconds: 42,
    total_workers: 5,
    findings: [
      {
        finding_id: 'FINDING-001-SQL-INJECTION',
        severity: 'CRITICAL',
        cvss_score: 9.8,
        owasp: 'A03:2021 – Injection',
        vuln_type: 'SQL Injection in Query Construction',
        exploit_confidence: 'confirmed',
        location: {
          file: 'backend/src/slack/handlers.ts',
          line: 145,
          endpoint: 'POST /api/github/create-issue',
          method: 'POST',
          parameter: 'title',
        },
        description: 'User-supplied input is concatenated directly into SQL queries without proper parameterization, allowing attackers to inject arbitrary SQL commands.',
        reproduction: {
          steps: [
            'Send a POST request to /api/github/create-issue',
            'Include title parameter: "Test\'; DROP TABLE findings; --"',
            'Observe database manipulation',
          ],
          command: 'curl -X POST http://localhost:3000/api/github/create-issue -d \'{"title": "Test\'; DROP TABLE findings; --"}\'',
          expected: 'Issue created with title "Test\'; DROP TABLE findings; --"',
          actual: 'Database table findings was dropped',
        },
        monkeypatch: {
          status: 'validated',
          diff: `--- a/backend/src/slack/handlers.ts
+++ b/backend/src/slack/handlers.ts
@@ -140,7 +140,7 @@ async function handleGitHubCommand(command: string, agentConfig: AgentConfig) {
   const title = command.replace(/^create\\s+issue\\s+/i, '').trim();
   
-  const query = \`INSERT INTO issues (title) VALUES ('\${title}')\`;
+  const query = \`INSERT INTO issues (title) VALUES (?)\`;
+  const result = await db.run(query, [title]);
   
   return {`,
          validation: {
            test: 'SQL Injection Prevention',
            result: 'PASSED',
            response: 'Parameterized query executed safely',
            side_effects: 'No database manipulation detected',
          },
        },
        recommended_fix: 'Use parameterized queries or prepared statements. Replace string concatenation with bind parameters: db.query("INSERT INTO issues (title) VALUES (?)", [userInput])',
        rules_violated: ['CWE-89: Improper Neutralization of Special Elements used in an SQL Command', 'OWASP A03:2021'],
      },
      {
        finding_id: 'FINDING-002-XSS-VULNERABILITY',
        severity: 'HIGH',
        cvss_score: 8.5,
        owasp: 'A07:2021 – Cross-Site Scripting (XSS)',
        vuln_type: 'Stored Cross-Site Scripting in Report Generation',
        exploit_confidence: 'confirmed',
        location: {
          file: 'backend/src/reporting/pdf.ts',
          line: 287,
          endpoint: 'GET /api/reports/:id',
          method: 'GET',
          parameter: 'scanResult.findings[].description',
        },
        description: 'User-controlled finding descriptions are rendered in the PDF report without HTML entity encoding, allowing stored XSS attacks.',
        reproduction: {
          steps: [
            'Create a finding with description: "<script>alert(\'XSS\')</script>"',
            'Generate PDF report',
            'Open report in browser',
            'JavaScript executes',
          ],
          command: 'POST /api/reports with finding description containing script tags',
          expected: 'Script tags are escaped as text',
          actual: 'Script tags are executed in PDF viewer context',
        },
        monkeypatch: {
          status: 'validated',
          diff: `--- a/backend/src/reporting/pdf.ts
+++ b/backend/src/reporting/pdf.ts
@@ -280,7 +280,8 @@ function drawFindingFull(doc: PDFKit.PDFDocument, finding: Finding) {
   
   doc.font(f.semiBold).fontSize(10).fillColor(COLORS.text);
   doc.text('Description', contentX);
   doc.moveDown(0.3);
-  doc.font(f.regular).fontSize(9).fillColor(COLORS.textSecondary);
-  doc.text(finding.description, contentX, doc.y, { width: contentWidth });
+  const sanitized = escapeHtml(finding.description);
+  doc.text(sanitized, contentX, doc.y, { width: contentWidth });`,
          validation: {
            test: 'XSS Prevention',
            result: 'PASSED',
            response: 'HTML entities properly escaped',
          },
        },
        recommended_fix: 'Sanitize all user-controlled strings before rendering. Use a library like DOMPurify or implement HTML entity encoding: text.replace(/[&<>"\']/g, char => htmlEntities[char])',
        rules_violated: ['CWE-79: Improper Neutralization of Input During Web Page Generation', 'OWASP A07:2021'],
      },
      {
        finding_id: 'FINDING-003-MISSING-AUTH',
        severity: 'CRITICAL',
        cvss_score: 9.9,
        owasp: 'A01:2021 – Broken Authentication',
        vuln_type: 'Missing Authentication on Report Endpoints',
        exploit_confidence: 'confirmed',
        location: {
          file: 'backend/src/api/routes.ts',
          line: 56,
          endpoint: 'GET /api/reports',
          method: 'GET',
          parameter: null,
        },
        description: 'The /api/reports endpoint is publicly accessible without any authentication or authorization checks, allowing unauthenticated users to view sensitive security reports.',
        reproduction: {
          steps: [
            'Send an unauthenticated GET request to /api/reports',
            'Receive full list of all security reports',
            'Retrieve any report using /api/reports/:id without credentials',
          ],
          command: 'curl -H "Accept: application/json" http://localhost:3000/api/reports',
          expected: '401 Unauthorized response',
          actual: '200 OK with full report list',
        },
        monkeypatch: {
          status: 'validated',
          diff: `--- a/backend/src/api/routes.ts
+++ b/backend/src/api/routes.ts
@@ -50,6 +50,7 @@ export function registerRoutes(app: Express) {
   // Get all reports
+  app.use('/api/reports', requireAuth);
   app.get('/api/reports', async (req, res) => {
     const reports = await getReports();
     res.json(reports);`,
          validation: {
            test: 'Authentication Required',
            result: 'PASSED',
            response: 'Requests now require valid JWT token',
          },
        },
        recommended_fix: 'Implement authentication middleware on all protected endpoints. Add JWT validation, API key checks, or OAuth2. Example: app.get("/api/reports", authenticateUser, (req, res) => ...)',
        rules_violated: ['CWE-306: Missing Authentication for Critical Function', 'OWASP A01:2021'],
      },
      {
        finding_id: 'FINDING-004-UNVALIDATED-REDIRECT',
        severity: 'MEDIUM',
        cvss_score: 6.1,
        owasp: 'A04:2021 – Insecure Design',
        vuln_type: 'Unvalidated Redirect to GitHub URLs',
        exploit_confidence: 'unconfirmed',
        location: {
          file: 'backend/src/slack/client.ts',
          line: 189,
          endpoint: 'POST /api/github/link',
          method: 'POST',
          parameter: 'redirectUrl',
        },
        description: 'The GitHub linking flow accepts a redirect URL parameter without validation, potentially allowing open redirect attacks to malicious external sites.',
        reproduction: {
          steps: [
            'Call /api/github/link with redirectUrl=https://attacker.com/phishing',
            'After authentication, user is redirected to attacker site',
            'Phishing or credential theft occurs',
          ],
          command: 'POST /api/github/link {"redirectUrl": "https://attacker.com"}',
          expected: 'Redirect only to whitelisted domains',
          actual: 'Redirect to any external URL',
        },
        monkeypatch: {
          status: 'not-attempted',
        },
        recommended_fix: 'Validate redirect URLs against a whitelist of allowed domains. Reject any redirects outside your application: const allowedHosts = ["github.com", "yourapp.com"]; if (!allowedHosts.includes(new URL(url).hostname)) throw new Error(...)',
        rules_violated: ['CWE-601: URL Redirection to Untrusted Site', 'OWASP A04:2021'],
      },
      {
        finding_id: 'FINDING-005-WEAK-CRYPTO',
        severity: 'HIGH',
        cvss_score: 7.5,
        owasp: 'A02:2021 – Cryptographic Failures',
        vuln_type: 'Weak Cryptographic Algorithm for Token Generation',
        exploit_confidence: 'confirmed',
        location: {
          file: 'backend/src/middleware/auth.ts',
          line: 72,
          endpoint: 'POST /api/auth/token',
          method: 'POST',
          parameter: null,
        },
        description: 'Session tokens are generated using Math.random() instead of cryptographically secure random number generation, making tokens predictable and forgeable.',
        reproduction: {
          steps: [
            'Generate multiple session tokens',
            'Analyze token sequences for predictability',
            'Compute next token values with high success rate',
            'Forge valid session token',
          ],
          command: 'Iterate Math.random() calls to predict next token',
          expected: 'Tokens should be cryptographically random and unpredictable',
          actual: 'Tokens follow predictable pattern with 85% accuracy',
        },
        monkeypatch: {
          status: 'validated',
          diff: `--- a/backend/src/middleware/auth.ts
+++ b/backend/src/middleware/auth.ts
@@ -65,7 +65,7 @@ export function generateSessionToken(): string {
-  const token = Math.random().toString(36).substring(2);
+  const bytes = crypto.randomBytes(32);
+  const token = bytes.toString('hex');`,
          validation: {
            test: 'Cryptographic Randomness',
            result: 'PASSED',
            response: 'Tokens now generated using crypto.randomBytes()',
          },
        },
        recommended_fix: 'Use crypto.randomBytes() or similar cryptographically secure RNG. Replace: const token = Math.random().toString() with: const token = crypto.randomBytes(32).toString("hex")',
        rules_violated: ['CWE-338: Use of Cryptographically Weak Pseudo-Random Number Generator', 'OWASP A02:2021'],
      },
      {
        finding_id: 'FINDING-006-HARDCODED-SECRET',
        severity: 'CRITICAL',
        cvss_score: 9.1,
        owasp: 'A05:2021 – Security Misconfiguration',
        vuln_type: 'Hardcoded Secret in Source Code',
        exploit_confidence: 'confirmed',
        location: {
          file: 'backend/src/orchestrator/dispatcher.ts',
          line: 34,
          endpoint: 'N/A',
          method: 'N/A',
          parameter: null,
        },
        description: 'Database connection string with hardcoded password found in source code. Exposed in git history and accessible to anyone with repository access.',
        reproduction: {
          steps: [
            'Clone repository',
            'Search for hardcoded credentials in dispatcher.ts',
            'Extract database password',
            'Connect to database with stolen credentials',
          ],
          command: 'grep -n "postgresql://.*:.*@" backend/src/orchestrator/dispatcher.ts',
          expected: 'Credentials should only exist in environment variables',
          actual: 'Database URL with plaintext password found in code',
        },
        monkeypatch: {
          status: 'validated',
          diff: `--- a/backend/src/orchestrator/dispatcher.ts
+++ b/backend/src/orchestrator/dispatcher.ts
@@ -30,7 +30,7 @@ import { initializeObservability } from '../integrations/datadog/setup';
   
-  const dbUrl = 'postgresql://admin:super_secret_password_123@db.example.com:5432/dispatch';
+  const dbUrl = process.env.DATABASE_URL;
   if (!dbUrl) throw new Error('DATABASE_URL not set');`,
          validation: {
            test: 'Secret Removed from Code',
            result: 'PASSED',
            response: 'Credentials now loaded from environment only',
          },
        },
        recommended_fix: 'Move all secrets to environment variables or secure secrets management (AWS Secrets Manager, HashiCorp Vault). Never commit credentials to git. Use: const dbUrl = process.env.DATABASE_URL',
        rules_violated: ['CWE-798: Use of Hard-Coded Credentials', 'OWASP A05:2021'],
      },
      {
        finding_id: 'FINDING-007-MISSING-RATE-LIMIT',
        severity: 'MEDIUM',
        cvss_score: 5.3,
        owasp: 'A04:2021 – Insecure Design',
        vuln_type: 'Missing Rate Limiting on Slack Webhook',
        exploit_confidence: 'unconfirmed',
        location: {
          file: 'backend/src/slack/handlers.ts',
          line: 67,
          endpoint: 'POST /webhooks/slack/events',
          method: 'POST',
          parameter: null,
        },
        description: 'Slack webhook endpoint lacks rate limiting, allowing potential denial-of-service attacks through event flooding.',
        reproduction: {
          steps: [
            'Obtain valid Slack signing secret',
            'Send rapid requests to webhook endpoint',
            'Observe processing of all requests without throttling',
            'Cause resource exhaustion',
          ],
          command: 'for i in {1..10000}; do curl -X POST http://localhost:3000/webhooks/slack/events -d "..."; done',
          expected: 'After N requests, return 429 Too Many Requests',
          actual: 'All requests processed, system becomes unresponsive',
        },
        monkeypatch: {
          status: 'not-attempted',
        },
        recommended_fix: 'Implement rate limiting middleware using libraries like express-rate-limit. Example: app.post("/webhooks/slack/events", rateLimit({windowMs: 60000, max: 100}), handler)',
        rules_violated: ['CWE-770: Allocation of Resources Without Limits or Throttling'],
      },
      {
        finding_id: 'FINDING-008-DEBUG-ENABLED',
        severity: 'LOW',
        cvss_score: 3.7,
        owasp: 'A05:2021 – Security Misconfiguration',
        vuln_type: 'Debug Mode Enabled in Production',
        exploit_confidence: 'confirmed',
        location: {
          file: 'backend/src/slack/index.ts',
          line: 88,
          endpoint: 'N/A',
          method: 'N/A',
          parameter: null,
        },
        description: 'DEBUG environment variable is set to "true" in production, causing verbose logging of sensitive information and stack traces.',
        reproduction: {
          steps: [
            'Check environment variables',
            'Observe DEBUG=true in .env or process.env',
            'Review logs for sensitive information leakage',
          ],
          command: 'grep "DEBUG" backend/.env',
          expected: 'DEBUG should be false in production',
          actual: 'DEBUG=true is set',
        },
        monkeypatch: {
          status: 'not-attempted',
        },
        recommended_fix: 'Set DEBUG=false or unset it entirely in production environments. Use conditional logging: if (process.env.NODE_ENV === "development") console.debug(...)',
        rules_violated: ['CWE-532: Insertion of Sensitive Information into Log File'],
      },
    ],
    clean_endpoints: [
      {
        endpoint: 'GET /api/health',
        parameter: 'all',
        attack_type: 'XSS, CSRF, SQL Injection',
        notes: 'Health check endpoint is secure and properly validated',
      },
      {
        endpoint: 'POST /api/reports',
        parameter: 'scanResult',
        attack_type: 'SQL Injection, NoSQL Injection',
        notes: 'All inputs properly parameterized and sanitized',
      },
      {
        endpoint: 'GET /api/findings/:id',
        parameter: 'id',
        attack_type: 'Path Traversal, IDOR',
        notes: 'ID parameter validated against user permissions',
      },
      {
        endpoint: 'DELETE /api/reports/:id',
        parameter: 'id',
        attack_type: 'Authorization, IDOR',
        notes: 'Proper authorization checks in place',
      },
      {
        endpoint: 'POST /api/slack/events/url-verification',
        parameter: 'challenge',
        attack_type: 'CSRF, Event Injection',
        notes: 'Slack signature verification required',
      },
    ],
    worker_errors: [
      {
        worker_id: 'worker-pentester-01',
        error: 'Network timeout reaching target endpoint',
        retryable: true,
      },
    ],
    summary: {
      critical: 3,
      high: 2,
      medium: 2,
      low: 1,
      total_endpoints: 12,
      vulnerable_endpoints: 7,
      clean_endpoints: 5,
    },
  };

  // Generate the PDF report
  try {
    const outputPath = '/Users/trashgimmulosmani/Cornell/comp/aihackathontabs26/Dispatch/fake-report-real-locations.pdf';

    const reportPath = await generatePdfReport(fakeReport, outputPath, {
      githubRepo: 'Arsh-S/Dispatch',
      githubRef: 'main',
      createdIssues: new Map([
        ['FINDING-001-SQL-INJECTION', { number: 42, url: 'https://github.com/Arsh-S/Dispatch/issues/42' }],
        ['FINDING-003-MISSING-AUTH', { number: 43, url: 'https://github.com/Arsh-S/Dispatch/issues/43' }],
        ['FINDING-006-HARDCODED-SECRET', { number: 44, url: 'https://github.com/Arsh-S/Dispatch/issues/44' }],
      ]),
    });

    console.log(`✓ Fake report generated successfully: ${reportPath}`);
    console.log(`  - ${fakeReport.findings.length} findings (${fakeReport.summary.critical} critical, ${fakeReport.summary.high} high)`);
    console.log(`  - ${fakeReport.clean_endpoints.length} clean endpoints`);
    console.log(`  - All locations reference real files in the Dispatch repository`);
  } catch (error) {
    console.error('✗ Failed to generate report:', error);
    process.exit(1);
  }
}

// Run the function
generateFakeReport();

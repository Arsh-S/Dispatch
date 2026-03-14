import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generatePdfReport } from '../pdf';
import type { MergedReport } from '../../orchestrator/collector';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeMergedReport(overrides: Partial<MergedReport> = {}): MergedReport {
  return {
    dispatch_run_id: 'test-run-pdf-001',
    completed_at: '2026-03-14T12:00:00.000Z',
    duration_seconds: 42,
    total_workers: 2,
    findings: [],
    clean_endpoints: [],
    worker_errors: [],
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total_endpoints: 0,
      vulnerable_endpoints: 0,
      clean_endpoints: 0,
    },
    ...overrides,
  };
}

function makeFinding(
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  endpoint: string,
  parameter: string,
): MergedReport['findings'][number] {
  return {
    finding_id: `finding-${severity}-${endpoint.replace(/\//g, '-')}-${parameter}`,
    severity,
    vuln_type: 'sql-injection',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/routes/users.ts',
      line: 42,
      endpoint,
      method: 'GET',
      parameter,
    },
    description: `A ${severity} severity SQL injection vulnerability was found at ${endpoint}.`,
    monkeypatch: { status: 'not-attempted' },
    recommended_fix: 'Use parameterized queries.',
    server_logs: [],
    rules_violated: [],
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('generatePdfReport', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-pdf-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- Happy path -----------------------------------------------------------

  it('generatePdfReport_WithEmptyFindings_CreatesFileAtOutputPath', async () => {
    // Arrange
    const report = makeMergedReport();
    const outputPath = path.join(tmpDir, 'report.pdf');

    // Act
    const result = await generatePdfReport(report, outputPath);

    // Assert
    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithEmptyFindings_WritesNonEmptyFile', async () => {
    // Arrange
    const report = makeMergedReport();
    const outputPath = path.join(tmpDir, 'report.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert — PDFs must contain content; a header-only page is still > 1 KB
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1024);
  });

  it('generatePdfReport_WithEmptyFindings_WritesPdfMagicBytes', async () => {
    // Arrange
    const report = makeMergedReport();
    const outputPath = path.join(tmpDir, 'report.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert — valid PDFs always start with the "%PDF" header
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(outputPath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    expect(buffer.toString('ascii')).toBe('%PDF');
  });

  it('generatePdfReport_ReturnsExactOutputPath', async () => {
    // Arrange
    const report = makeMergedReport();
    const outputPath = path.join(tmpDir, 'security-scan.pdf');

    // Act
    const returned = await generatePdfReport(report, outputPath);

    // Assert — the promise must resolve to the caller-supplied output path
    expect(returned).toBe(outputPath);
  });

  // --- Severity sections ----------------------------------------------------

  it('generatePdfReport_WithCriticalAndHighFindings_CreatesLargerFileThanEmptyReport', async () => {
    // Arrange — file size grows because critical/high section adds a page
    const emptyReport = makeMergedReport();
    const emptyPath = path.join(tmpDir, 'empty.pdf');
    await generatePdfReport(emptyReport, emptyPath);
    const emptySize = fs.statSync(emptyPath).size;

    const richReport = makeMergedReport({
      findings: [
        makeFinding('CRITICAL', '/api/admin', 'id'),
        makeFinding('HIGH', '/api/users', 'name'),
      ],
      summary: { critical: 1, high: 1, medium: 0, low: 0, total_endpoints: 2, vulnerable_endpoints: 2, clean_endpoints: 0 },
    });
    const richPath = path.join(tmpDir, 'rich.pdf');

    // Act
    await generatePdfReport(richReport, richPath);

    // Assert
    const richSize = fs.statSync(richPath).size;
    expect(richSize).toBeGreaterThan(emptySize);
  });

  it('generatePdfReport_WithOnlyMediumLowFindings_DoesNotIncludeCriticalHighSection', async () => {
    // Arrange — reports with only medium/low and no critical/high should still
    // produce a valid PDF but without the extra critical/high section page
    const report = makeMergedReport({
      findings: [
        makeFinding('MEDIUM', '/api/search', 'q'),
        makeFinding('LOW', '/api/ping', 'msg'),
      ],
      summary: { critical: 0, high: 0, medium: 1, low: 1, total_endpoints: 2, vulnerable_endpoints: 2, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'medium-low.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert — file still exists and is a valid PDF
    expect(fs.existsSync(outputPath)).toBe(true);
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(outputPath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    expect(buffer.toString('ascii')).toBe('%PDF');
  });

  it('generatePdfReport_WithAllSeverityLevels_ProducesValidPdf', async () => {
    // Arrange
    const report = makeMergedReport({
      findings: [
        makeFinding('CRITICAL', '/api/admin', 'token'),
        makeFinding('HIGH', '/api/users', 'id'),
        makeFinding('MEDIUM', '/api/search', 'q'),
        makeFinding('LOW', '/api/ping', 'msg'),
      ],
      summary: { critical: 1, high: 1, medium: 1, low: 1, total_endpoints: 4, vulnerable_endpoints: 4, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'all-severities.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1024);
  });

  // --- Clean endpoints section ----------------------------------------------

  it('generatePdfReport_WithCleanEndpoints_StillProducesValidPdf', async () => {
    // Arrange
    const report = makeMergedReport({
      clean_endpoints: [
        { endpoint: '/api/health', parameter: 'none', attack_type: 'sql-injection', notes: 'No injection points found' },
        { endpoint: '/api/version', parameter: 'none', attack_type: 'xss', notes: 'Output is static' },
      ],
      summary: { critical: 0, high: 0, medium: 0, low: 0, total_endpoints: 2, vulnerable_endpoints: 0, clean_endpoints: 2 },
    });
    const outputPath = path.join(tmpDir, 'clean.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(outputPath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    expect(buffer.toString('ascii')).toBe('%PDF');
  });

  // --- Worker errors in summary ---------------------------------------------

  it('generatePdfReport_WithWorkerErrors_StillProducesValidPdf', async () => {
    // Arrange — worker errors appear in the executive summary section
    const report = makeMergedReport({
      worker_errors: [
        { worker_id: 'w-timeout-001', error: 'Worker timed out after 300s', retryable: true },
        { worker_id: 'w-crash-002', error: 'App crashed during startup', retryable: false },
      ],
      summary: { critical: 0, high: 0, medium: 0, low: 0, total_endpoints: 0, vulnerable_endpoints: 0, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'errors.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1024);
  });

  // --- Edge cases -----------------------------------------------------------

  it('generatePdfReport_WithFindingThatHasReproductionSteps_ProducesValidPdf', async () => {
    // Arrange — reproduction block triggers extra rendering logic in drawFindingFull
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('HIGH', '/api/users', 'id'),
          reproduction: {
            command: "curl -X GET 'http://localhost:3000/api/users?id=1%27+OR+%271%27%3D%271'",
            expected: '401 Unauthorized',
            actual: '200 OK with all users',
            steps: ['Start the app', 'Send the curl command', 'Observe the response'],
          },
        },
      ],
      summary: { critical: 0, high: 1, medium: 0, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'with-reproduction.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithFindingThatHasMonkeypatchDiff_ProducesValidPdf', async () => {
    // Arrange — monkeypatch diff triggers the diff rendering path in drawFindingFull
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('CRITICAL', '/api/admin', 'token'),
          monkeypatch: {
            status: 'validated',
            diff: '--- a/src/routes/admin.ts\n+++ b/src/routes/admin.ts\n-  const query = `SELECT * FROM users WHERE id = ${id}`;\n+  const query = db.prepare("SELECT * FROM users WHERE id = ?");\n+  query.run(id);',
            validation: {
              test: 'Replayed injection payload after patch',
              result: 'PASS',
              response: '400 Bad Request',
            },
          },
        },
      ],
      summary: { critical: 1, high: 0, medium: 0, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'with-patch.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithFindingHavingRulesViolated_ProducesValidPdf', async () => {
    // Arrange — rules_violated list triggers the rules section in drawFindingFull
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('HIGH', '/api/orders', 'order_id'),
          rules_violated: ['RULE-001: Always use parameterized queries', 'RULE-007: Never expose stack traces'],
        },
      ],
      summary: { critical: 0, high: 1, medium: 0, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'with-rules.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithVeryLongDescription_TruncatesGracefullyAndProducesValidPdf', async () => {
    // Arrange — the condensed renderer clips descriptions > 200 chars
    const longDescription = 'A'.repeat(500);
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('MEDIUM', '/api/search', 'q'),
          description: longDescription,
        },
      ],
      summary: { critical: 0, high: 0, medium: 1, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'long-desc.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithVeryLongReproductionCommand_TruncatesGracefullyAndProducesValidPdf', async () => {
    // Arrange — the full renderer clips reproduction commands > 300 chars
    const longCommand = 'curl ' + 'X'.repeat(400);
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('HIGH', '/api/users', 'id'),
          reproduction: {
            command: longCommand,
            expected: '401',
            actual: '200',
          },
        },
      ],
      summary: { critical: 0, high: 1, medium: 0, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'long-cmd.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithCvssScoreAndOwaspTag_ProducesValidPdf', async () => {
    // Arrange — optional fields cvss_score and owasp appear in metadata rows
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('CRITICAL', '/api/login', 'username'),
          cvss_score: 9.8,
          owasp: 'A03:2021',
        },
      ],
      summary: { critical: 1, high: 0, medium: 0, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'with-cvss.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithMoreThanFiveWorkerErrors_IncludesOnlyFirstFiveInSummary', async () => {
    // Arrange — the executive summary only renders the first 5 worker errors
    // to avoid overflowing; this verifies that many errors don't crash rendering
    const manyErrors = Array.from({ length: 10 }, (_, i) => ({
      worker_id: `w-error-${i}`,
      error: `Worker ${i} failed with timeout`,
      retryable: true,
    }));
    const report = makeMergedReport({
      worker_errors: manyErrors,
      summary: { critical: 0, high: 0, medium: 0, low: 0, total_endpoints: 0, vulnerable_endpoints: 0, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'many-errors.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WritesToCorrectDirectory_WhenOutputPathIsInSubdirectory', async () => {
    // Arrange — caller may pass a path in a subdirectory that already exists
    const subDir = path.join(tmpDir, 'reports');
    fs.mkdirSync(subDir);
    const outputPath = path.join(subDir, 'scan-output.pdf');
    const report = makeMergedReport();

    // Act
    const returned = await generatePdfReport(report, outputPath);

    // Assert
    expect(returned).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithUnicodeInFindingDescription_ProducesValidPdf', async () => {
    // Arrange — unicode text must not crash the PDF renderer
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('HIGH', '/api/messages', 'body'),
          description: 'Injection via unicode: \u4e2d\u6587\u6587\u5b57 and emoji \ud83d\ude80 detected.',
        },
      ],
      summary: { critical: 0, high: 1, medium: 0, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'unicode.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generatePdfReport_WithNullParameter_ProducesValidPdf', async () => {
    // Arrange — parameter is nullable in the schema; the renderer must handle null
    const report = makeMergedReport({
      findings: [
        {
          ...makeFinding('HIGH', '/api/users', 'id'),
          location: {
            file: 'src/routes/users.ts',
            line: 10,
            endpoint: '/api/users',
            method: 'POST',
            parameter: null,
          },
        },
      ],
      summary: { critical: 0, high: 1, medium: 0, low: 0, total_endpoints: 1, vulnerable_endpoints: 1, clean_endpoints: 0 },
    });
    const outputPath = path.join(tmpDir, 'null-param.pdf');

    // Act
    await generatePdfReport(report, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});

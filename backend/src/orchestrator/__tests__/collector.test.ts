import { describe, it, expect } from 'vitest';
import { mergeReports, MergedReport } from '../collector';
import { FindingReport, Finding } from '../../schemas/finding-report';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    finding_id: 'f-001',
    severity: 'HIGH',
    vuln_type: 'sql-injection',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/routes/users.ts',
      line: 42,
      endpoint: '/api/users',
      method: 'GET',
      parameter: 'id',
    },
    description: 'SQL injection found',
    monkeypatch: { status: 'not-attempted' },
    recommended_fix: 'Use parameterized queries',
    server_logs: [],
    rules_violated: [],
    ...overrides,
  };
}

function makeReport(overrides: Partial<FindingReport> = {}): FindingReport {
  return {
    dispatch_run_id: 'run-1',
    worker_id: 'w-1',
    completed_at: '2026-03-14T12:00:00.000Z',
    status: 'completed',
    duration_seconds: 60,
    error_detail: null,
    findings: [],
    clean_endpoints: [],
    ...overrides,
  };
}

describe('mergeReports', () => {
  it('should merge findings from multiple reports', () => {
    const reports: FindingReport[] = [
      makeReport({
        worker_id: 'w-1',
        findings: [makeFinding({ finding_id: 'f-1', location: { file: 'a.ts', line: 1, endpoint: '/api/a', method: 'GET', parameter: 'x' } })],
      }),
      makeReport({
        worker_id: 'w-2',
        findings: [makeFinding({ finding_id: 'f-2', location: { file: 'b.ts', line: 2, endpoint: '/api/b', method: 'POST', parameter: 'y' } })],
      }),
    ];

    const merged = mergeReports(reports);
    expect(merged.findings.length).toBe(2);
    expect(merged.total_workers).toBe(2);
  });

  it('should deduplicate findings with same endpoint+parameter+vuln_type', () => {
    const finding1 = makeFinding({ finding_id: 'f-1', exploit_confidence: 'unconfirmed' });
    const finding2 = makeFinding({ finding_id: 'f-2', exploit_confidence: 'confirmed' });

    const reports: FindingReport[] = [
      makeReport({ worker_id: 'w-1', findings: [finding1] }),
      makeReport({ worker_id: 'w-2', findings: [finding2] }),
    ];

    const merged = mergeReports(reports);
    expect(merged.findings.length).toBe(1);
    // Should keep the confirmed one
    expect(merged.findings[0].exploit_confidence).toBe('confirmed');
  });

  it('should sort findings by severity (CRITICAL first)', () => {
    const reports: FindingReport[] = [
      makeReport({
        findings: [
          makeFinding({ finding_id: 'f-low', severity: 'LOW', location: { file: 'a.ts', line: 1, endpoint: '/a', method: 'GET', parameter: 'p1' } }),
          makeFinding({ finding_id: 'f-crit', severity: 'CRITICAL', location: { file: 'b.ts', line: 2, endpoint: '/b', method: 'GET', parameter: 'p2' } }),
          makeFinding({ finding_id: 'f-med', severity: 'MEDIUM', location: { file: 'c.ts', line: 3, endpoint: '/c', method: 'GET', parameter: 'p3' } }),
        ],
      }),
    ];

    const merged = mergeReports(reports);
    expect(merged.findings[0].severity).toBe('CRITICAL');
    expect(merged.findings[1].severity).toBe('MEDIUM');
    expect(merged.findings[2].severity).toBe('LOW');
  });

  it('should track worker errors for non-completed reports', () => {
    const reports: FindingReport[] = [
      makeReport({ worker_id: 'w-ok', status: 'completed' }),
      makeReport({
        worker_id: 'w-fail',
        status: 'timeout',
        error_detail: {
          type: 'timeout',
          code: 'ETIMEOUT',
          message: 'Worker timed out',
          retryable: true,
          phase: 'execution',
        },
      }),
    ];

    const merged = mergeReports(reports);
    expect(merged.worker_errors.length).toBe(1);
    expect(merged.worker_errors[0].worker_id).toBe('w-fail');
    expect(merged.worker_errors[0].retryable).toBe(true);
  });

  it('should calculate correct summary counts', () => {
    const reports: FindingReport[] = [
      makeReport({
        findings: [
          makeFinding({ severity: 'CRITICAL', location: { file: 'a.ts', line: 1, endpoint: '/api/a', method: 'GET', parameter: 'x' } }),
          makeFinding({ severity: 'HIGH', location: { file: 'a.ts', line: 2, endpoint: '/api/b', method: 'GET', parameter: 'y' } }),
        ],
        clean_endpoints: [
          { endpoint: '/api/health', parameter: 'none', attack_type: 'sql-injection', notes: 'Clean' },
        ],
      }),
    ];

    const merged = mergeReports(reports);
    expect(merged.summary.critical).toBe(1);
    expect(merged.summary.high).toBe(1);
    expect(merged.summary.medium).toBe(0);
    expect(merged.summary.low).toBe(0);
    expect(merged.summary.vulnerable_endpoints).toBe(2);
    expect(merged.summary.clean_endpoints).toBe(1);
    expect(merged.summary.total_endpoints).toBe(3);
  });

  it('should use max duration across reports', () => {
    const reports: FindingReport[] = [
      makeReport({ duration_seconds: 30 }),
      makeReport({ duration_seconds: 120 }),
      makeReport({ duration_seconds: 60 }),
    ];

    const merged = mergeReports(reports);
    expect(merged.duration_seconds).toBe(120);
  });

  it('should handle empty reports array', () => {
    const merged = mergeReports([]);
    expect(merged.findings.length).toBe(0);
    expect(merged.total_workers).toBe(0);
    expect(merged.dispatch_run_id).toBe('');
  });

  it('should collect clean endpoints from all reports', () => {
    const reports: FindingReport[] = [
      makeReport({
        clean_endpoints: [
          { endpoint: '/api/a', parameter: 'none', attack_type: 'xss', notes: 'Clean' },
        ],
      }),
      makeReport({
        clean_endpoints: [
          { endpoint: '/api/b', parameter: 'none', attack_type: 'sql-injection', notes: 'Clean' },
        ],
      }),
    ];

    const merged = mergeReports(reports);
    expect(merged.clean_endpoints.length).toBe(2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeReports, forwardToDatadog, MergedReport, contentBasedFindingHash, generateFindingKey } from '../collector';
import { FindingReport, Finding } from '../../schemas/finding-report';

const { mockIsEnabled, mockSendEvent, mockSendMetrics } = vi.hoisted(() => ({
  mockIsEnabled: vi.fn(),
  mockSendEvent: vi.fn(),
  mockSendMetrics: vi.fn(),
}));

vi.mock('../../integrations/datadog/client.js', () => ({
  isEnabled: () => mockIsEnabled(),
  sendEvent: (...args: unknown[]) => mockSendEvent(...args),
  sendMetrics: (...args: unknown[]) => mockSendMetrics(...args),
}));

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

  it('should deduplicate worker-namespaced finding_ids by content key', () => {
    const hash = contentBasedFindingHash('/api/users', 'id', 'sql-injection');
    const finding1 = makeFinding({
      finding_id: `worker-1:finding-sql-injection-${hash}`,
      exploit_confidence: 'unconfirmed',
    });
    const finding2 = makeFinding({
      finding_id: `worker-2:finding-sql-injection-${hash}`,
      exploit_confidence: 'confirmed',
    });

    const reports: FindingReport[] = [
      makeReport({ worker_id: 'worker-1', findings: [finding1] }),
      makeReport({ worker_id: 'worker-2', findings: [finding2] }),
    ];

    const merged = mergeReports(reports);
    expect(merged.findings.length).toBe(1);
    expect(merged.findings[0].exploit_confidence).toBe('confirmed');
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

describe('forwardToDatadog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEvent.mockResolvedValue(undefined);
    mockSendMetrics.mockResolvedValue(undefined);
  });

  function makeMergedReport(overrides: Partial<MergedReport> = {}): MergedReport {
    return {
      dispatch_run_id: 'run-abc123',
      completed_at: '2026-03-14T12:00:00.000Z',
      duration_seconds: 45,
      total_workers: 2,
      findings: [],
      clean_endpoints: [],
      worker_errors: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 2,
        low: 1,
        total_endpoints: 10,
        vulnerable_endpoints: 3,
        clean_endpoints: 7,
      },
      ...overrides,
    };
  }

  it('should be a no-op when isEnabled returns false', async () => {
    mockIsEnabled.mockReturnValue(false);
    const report = makeMergedReport();

    await forwardToDatadog(report);

    expect(mockSendEvent).not.toHaveBeenCalled();
    expect(mockSendMetrics).not.toHaveBeenCalled();
  });

  it('should send event with alert_type error when critical findings exist', async () => {
    mockIsEnabled.mockReturnValue(true);
    const report = makeMergedReport({ summary: { ...makeMergedReport().summary, critical: 1 } });

    await forwardToDatadog(report);

    expect(mockSendEvent).toHaveBeenCalledTimes(1);
    expect(mockSendEvent.mock.calls[0][0]).toMatchObject({
      alert_type: 'error',
      title: expect.stringContaining('run-abc123'),
    });
  });

  it('should send event with alert_type warning when only high findings', async () => {
    mockIsEnabled.mockReturnValue(true);
    const report = makeMergedReport({ summary: { ...makeMergedReport().summary, high: 2, critical: 0 } });

    await forwardToDatadog(report);

    expect(mockSendEvent).toHaveBeenCalledTimes(1);
    expect(mockSendEvent.mock.calls[0][0].alert_type).toBe('warning');
  });

  it('should send event with alert_type info when only medium/low findings', async () => {
    mockIsEnabled.mockReturnValue(true);
    const report = makeMergedReport({ summary: { ...makeMergedReport().summary, medium: 1, low: 2 } });

    await forwardToDatadog(report);

    expect(mockSendEvent).toHaveBeenCalledTimes(1);
    expect(mockSendEvent.mock.calls[0][0].alert_type).toBe('info');
  });

  it('should include finding counts in event text', async () => {
    mockIsEnabled.mockReturnValue(true);
    const report = makeMergedReport({
      summary: { critical: 1, high: 2, medium: 3, low: 4, total_endpoints: 10, vulnerable_endpoints: 5, clean_endpoints: 5 },
    });

    await forwardToDatadog(report);

    const event = mockSendEvent.mock.calls[0][0];
    expect(event.text).toContain('Critical: 1');
    expect(event.text).toContain('High: 2');
    expect(event.text).toContain('Medium: 3');
    expect(event.text).toContain('Low: 4');
  });

  it('should send 6 metric series with correct values', async () => {
    mockIsEnabled.mockReturnValue(true);
    const report = makeMergedReport({
      summary: { critical: 1, high: 2, medium: 3, low: 4, total_endpoints: 10, vulnerable_endpoints: 5, clean_endpoints: 5 },
      duration_seconds: 90,
      total_workers: 3,
    });

    await forwardToDatadog(report);

    expect(mockSendMetrics).toHaveBeenCalledTimes(1);
    const { series } = mockSendMetrics.mock.calls[0][0];
    expect(series).toHaveLength(6);

    const byMetric = Object.fromEntries(series.map((s: { metric: string; points: { value: number }[] }) => [s.metric, s.points[0].value]));
    expect(byMetric['dispatch.findings.critical']).toBe(1);
    expect(byMetric['dispatch.findings.high']).toBe(2);
    expect(byMetric['dispatch.findings.medium']).toBe(3);
    expect(byMetric['dispatch.findings.low']).toBe(4);
    expect(byMetric['dispatch.scan.duration_seconds']).toBe(90);
    expect(byMetric['dispatch.scan.workers']).toBe(3);
  });

  it('should tag event and metrics with dispatch_run_id', async () => {
    mockIsEnabled.mockReturnValue(true);
    const report = makeMergedReport({ dispatch_run_id: 'run-xyz789' });

    await forwardToDatadog(report);

    expect(mockSendEvent.mock.calls[0][0].tags).toContain('dispatch_run_id:run-xyz789');
    const { series } = mockSendMetrics.mock.calls[0][0];
    expect(series[0].tags).toContain('dispatch_run_id:run-xyz789');
  });

  it('should call sendEvent and sendMetrics in parallel', async () => {
    mockIsEnabled.mockReturnValue(true);
    const report = makeMergedReport();

    await forwardToDatadog(report);

    expect(mockSendEvent).toHaveBeenCalled();
    expect(mockSendMetrics).toHaveBeenCalled();
  });
});

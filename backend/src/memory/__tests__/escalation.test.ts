import { describe, it, expect } from 'vitest';
import { applyEscalation } from '../escalation';
import { generateFindingFingerprint } from '../fingerprint';
import type { MergedReport } from '../../orchestrator/collector';

function makeFinding(overrides: Partial<any> = {}): any {
  return {
    finding_id: 'f-1',
    severity: 'HIGH',
    vuln_type: 'SQL Injection',
    exploit_confidence: 'confirmed',
    location: {
      file: 'app.py',
      line: 42,
      endpoint: '/api/orders',
      method: 'POST',
      parameter: 'id',
    },
    description: 'SQL injection in orders endpoint',
    recommended_fix: 'Use parameterised queries',
    server_logs: [],
    monkeypatch: { status: 'not-attempted' },
    rules_violated: [],
    ...overrides,
  };
}

function makeReport(findings: any[]): MergedReport {
  return {
    dispatch_run_id: 'run-1',
    completed_at: new Date().toISOString(),
    duration_seconds: 30,
    total_workers: 1,
    findings,
    clean_endpoints: [],
    worker_errors: [],
    summary: {
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      high: findings.filter(f => f.severity === 'HIGH').length,
      medium: findings.filter(f => f.severity === 'MEDIUM').length,
      low: findings.filter(f => f.severity === 'LOW').length,
      total_endpoints: 1,
      vulnerable_endpoints: 1,
      clean_endpoints: 0,
    },
  };
}

describe('applyEscalation', () => {
  it('escalates HIGH to CRITICAL after 4 consecutive scans', () => {
    const finding = makeFinding({ severity: 'HIGH' });
    const fp = generateFindingFingerprint(finding);
    const counts = new Map([[fp, 4]]);

    const result = applyEscalation(makeReport([finding]), counts);
    expect(result.findings[0].severity).toBe('CRITICAL');
    expect((result.findings[0] as any).escalated_from).toBe('HIGH');
    expect((result.findings[0] as any).consecutive_count).toBe(4);
    expect(result.summary.critical).toBe(1);
    expect(result.summary.high).toBe(0);
  });

  it('escalates MEDIUM to HIGH after 2 consecutive scans', () => {
    const finding = makeFinding({ severity: 'MEDIUM' });
    const fp = generateFindingFingerprint(finding);
    const counts = new Map([[fp, 2]]);

    const result = applyEscalation(makeReport([finding]), counts);
    expect(result.findings[0].severity).toBe('HIGH');
    expect((result.findings[0] as any).escalated_from).toBe('MEDIUM');
  });

  it('escalates MEDIUM to CRITICAL after 4 consecutive scans', () => {
    const finding = makeFinding({ severity: 'MEDIUM' });
    const fp = generateFindingFingerprint(finding);
    const counts = new Map([[fp, 4]]);

    const result = applyEscalation(makeReport([finding]), counts);
    expect(result.findings[0].severity).toBe('CRITICAL');
    expect((result.findings[0] as any).escalated_from).toBe('MEDIUM');
  });

  it('does not escalate HIGH with only 2 consecutive scans', () => {
    const finding = makeFinding({ severity: 'HIGH' });
    const fp = generateFindingFingerprint(finding);
    const counts = new Map([[fp, 2]]);

    const result = applyEscalation(makeReport([finding]), counts);
    expect(result.findings[0].severity).toBe('HIGH');
    expect((result.findings[0] as any).escalated_from).toBeUndefined();
    expect((result.findings[0] as any).consecutive_count).toBe(2);
  });

  it('does not escalate CRITICAL (already max)', () => {
    const finding = makeFinding({ severity: 'CRITICAL' });
    const fp = generateFindingFingerprint(finding);
    const counts = new Map([[fp, 10]]);

    const result = applyEscalation(makeReport([finding]), counts);
    expect(result.findings[0].severity).toBe('CRITICAL');
    expect((result.findings[0] as any).escalated_from).toBeUndefined();
  });

  it('no memory data → no changes', () => {
    const finding = makeFinding({ severity: 'HIGH' });
    const counts = new Map<string, number>();

    const result = applyEscalation(makeReport([finding]), counts);
    expect(result.findings[0].severity).toBe('HIGH');
    expect((result.findings[0] as any).escalated_from).toBeUndefined();
  });

  it('updates summary counts after escalation', () => {
    const f1 = makeFinding({ severity: 'HIGH', finding_id: 'f-1' });
    const f2 = makeFinding({
      severity: 'MEDIUM',
      finding_id: 'f-2',
      vuln_type: 'XSS',
      location: { file: 'x.py', line: 1, endpoint: '/xss', method: 'GET', parameter: null },
    });

    const fp1 = generateFindingFingerprint(f1);
    const fp2 = generateFindingFingerprint(f2);
    const counts = new Map([[fp1, 4], [fp2, 3]]);

    const result = applyEscalation(makeReport([f1, f2]), counts);
    expect(result.summary.critical).toBe(1); // f1: HIGH→CRITICAL
    expect(result.summary.high).toBe(1);     // f2: MEDIUM→HIGH
    expect(result.summary.medium).toBe(0);
  });
});

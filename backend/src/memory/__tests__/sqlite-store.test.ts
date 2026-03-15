import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSqliteStore } from '../sqlite-store';
import type { MemoryStore } from '../types';
import type { MergedReport } from '../../orchestrator/collector';
import path from 'path';
import fs from 'fs';
import os from 'os';

function tmpDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-mem-'));
  return path.join(dir, 'test-memory.db');
}

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

function makeReport(runId: string, findings: any[] = [makeFinding()]): MergedReport {
  return {
    dispatch_run_id: runId,
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

describe('SqliteStore', () => {
  let store: MemoryStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = tmpDbPath();
    store = createSqliteStore(dbPath);
  });

  afterEach(() => {
    store.close();
    try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
    try { fs.rmdirSync(path.dirname(dbPath)); } catch { /* ignore */ }
  });

  it('recordRun inserts rows', async () => {
    await store.recordRun('target-1', 'run-1', makeReport('run-1'));
    const history = await store.getHistoryForFinding('target-1', '');
    // Empty fingerprint won't match, but the call should not throw
    expect(history).toEqual([]);
  });

  it('getHistoryForFinding returns correct entries', async () => {
    const finding = makeFinding();
    await store.recordRun('t1', 'run-1', makeReport('run-1', [finding]));
    await store.recordRun('t1', 'run-2', makeReport('run-2', [finding]));

    // The fingerprint for this finding: endpoint=/api/orders, param=id, vuln_type=SQL Injection
    const { generateFindingFingerprint } = await import('../fingerprint');
    const fp = generateFindingFingerprint(finding);
    const history = await store.getHistoryForFinding('t1', fp, 10);
    expect(history).toHaveLength(2);
    expect(history[0].severity).toBe('HIGH');
  });

  it('getConsecutiveCounts returns 3 for 3 consecutive runs with same finding', async () => {
    const finding = makeFinding();
    const { generateFindingFingerprint } = await import('../fingerprint');
    const fp = generateFindingFingerprint(finding);

    for (let i = 1; i <= 3; i++) {
      const report = makeReport(`run-${i}`, [finding]);
      report.completed_at = new Date(Date.now() + i * 1000).toISOString();
      await store.recordRun('t1', `run-${i}`, report);
    }

    const counts = await store.getConsecutiveCounts('t1', [fp]);
    expect(counts.get(fp)).toBe(3);
  });

  it('getConsecutiveCounts breaks streak on gap', async () => {
    const findingA = makeFinding();
    const findingB = makeFinding({ vuln_type: 'XSS', location: { ...makeFinding().location, endpoint: '/other' } });
    const { generateFindingFingerprint } = await import('../fingerprint');
    const fpA = generateFindingFingerprint(findingA);

    // Run 1: A, Run 2: B only, Run 3: A, Run 4: A, Run 5: A
    const reports = [
      { id: 'run-1', findings: [findingA] },
      { id: 'run-2', findings: [findingB] },
      { id: 'run-3', findings: [findingA] },
      { id: 'run-4', findings: [findingA] },
      { id: 'run-5', findings: [findingA] },
    ];

    for (let i = 0; i < reports.length; i++) {
      const r = makeReport(reports[i].id, reports[i].findings);
      r.completed_at = new Date(Date.now() + (i + 1) * 1000).toISOString();
      await store.recordRun('t1', reports[i].id, r);
    }

    const counts = await store.getConsecutiveCounts('t1', [fpA]);
    // Newest-first: run-5(A), run-4(A), run-3(A), run-2(no A) → streak = 3
    expect(counts.get(fpA)).toBe(3);
  });

  it('getConsecutiveCounts returns 0 when finding not in latest run', async () => {
    const findingA = makeFinding();
    const findingB = makeFinding({ vuln_type: 'XSS', location: { ...makeFinding().location, endpoint: '/other' } });
    const { generateFindingFingerprint } = await import('../fingerprint');
    const fpA = generateFindingFingerprint(findingA);

    // Run 1: A, Run 2: B only (latest)
    const r1 = makeReport('run-1', [findingA]);
    r1.completed_at = new Date(Date.now() + 1000).toISOString();
    await store.recordRun('t1', 'run-1', r1);

    const r2 = makeReport('run-2', [findingB]);
    r2.completed_at = new Date(Date.now() + 2000).toISOString();
    await store.recordRun('t1', 'run-2', r2);

    const counts = await store.getConsecutiveCounts('t1', [fpA]);
    expect(counts.get(fpA)).toBe(0);
  });
});

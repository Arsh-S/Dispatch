import { describe, it, expect, beforeEach } from 'vitest';
import { DiagnosticsAggregator } from '../aggregator';
import type { AgentDiagnostics, LoopAlert } from '../../schemas/agent-diagnostics';

function makeDiagnostics(overrides: Partial<AgentDiagnostics> = {}): AgentDiagnostics {
  return {
    worker_id: 'worker-1',
    worker_type: 'pentester',
    dispatch_run_id: 'run-001',
    started_at: '2026-03-14T10:00:00.000Z',
    updated_at: '2026-03-14T10:01:00.000Z',
    wall_clock_seconds: 60,
    trace_length: 10,
    tool_calls: {},
    total_tool_calls: 10,
    lines_added: 0,
    lines_removed: 0,
    unique_files_touched: [],
    repeated_calls: 0,
    error_count: 0,
    consecutive_errors: 0,
    phase: 'attack',
    findings_so_far: 0,
    last_action: '',
    ...overrides,
  };
}

function makeAlert(overrides: Partial<LoopAlert> = {}): LoopAlert {
  return {
    worker_id: 'worker-1',
    worker_type: 'pentester',
    dispatch_run_id: 'run-001',
    triggered_at: '2026-03-14T10:05:00.000Z',
    reasons: ['Trace length exceeded'],
    diagnostics: makeDiagnostics(),
    auto_killed: false,
    ...overrides,
  };
}

describe('DiagnosticsAggregator', () => {
  let agg: DiagnosticsAggregator;

  beforeEach(() => {
    agg = new DiagnosticsAggregator();
  });

  it('should start empty', () => {
    expect(agg.size()).toBe(0);
    expect(agg.getAll()).toEqual([]);
    expect(agg.alertCount()).toBe(0);
  });

  it('should upsert and get diagnostics', () => {
    const diag = makeDiagnostics();
    agg.upsert(diag);

    expect(agg.size()).toBe(1);
    expect(agg.get('worker-1')).toEqual(diag);
  });

  it('should update existing diagnostics on upsert', () => {
    agg.upsert(makeDiagnostics({ trace_length: 10 }));
    agg.upsert(makeDiagnostics({ trace_length: 20 }));

    expect(agg.size()).toBe(1);
    expect(agg.get('worker-1')!.trace_length).toBe(20);
  });

  it('should return all diagnostics', () => {
    agg.upsert(makeDiagnostics({ worker_id: 'w-1' }));
    agg.upsert(makeDiagnostics({ worker_id: 'w-2' }));

    const all = agg.getAll();
    expect(all).toHaveLength(2);
  });

  it('should filter by run id', () => {
    agg.upsert(makeDiagnostics({ worker_id: 'w-1', dispatch_run_id: 'run-A' }));
    agg.upsert(makeDiagnostics({ worker_id: 'w-2', dispatch_run_id: 'run-B' }));

    const runA = agg.getByRunId('run-A');
    expect(runA).toHaveLength(1);
    expect(runA[0].worker_id).toBe('w-1');
  });

  it('should filter active workers (not complete/error)', () => {
    agg.upsert(makeDiagnostics({ worker_id: 'w-1', phase: 'attack' }));
    agg.upsert(makeDiagnostics({ worker_id: 'w-2', phase: 'complete' }));
    agg.upsert(makeDiagnostics({ worker_id: 'w-3', phase: 'error' }));

    const active = agg.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].worker_id).toBe('w-1');
  });

  it('should remove a worker', () => {
    agg.upsert(makeDiagnostics({ worker_id: 'w-1' }));
    expect(agg.remove('w-1')).toBe(true);
    expect(agg.size()).toBe(0);
    expect(agg.remove('nonexistent')).toBe(false);
  });

  it('should clear all diagnostics', () => {
    agg.upsert(makeDiagnostics({ worker_id: 'w-1' }));
    agg.upsert(makeDiagnostics({ worker_id: 'w-2' }));
    agg.clear();
    expect(agg.size()).toBe(0);
  });

  it('should return undefined for missing workers', () => {
    expect(agg.get('nonexistent')).toBeUndefined();
  });

  // -- Alert tests --

  it('should add and retrieve alerts', () => {
    agg.addAlert(makeAlert());
    expect(agg.alertCount()).toBe(1);
    expect(agg.getAlerts()).toHaveLength(1);
    expect(agg.getAlerts()[0].worker_id).toBe('worker-1');
  });

  it('should filter alerts by run id', () => {
    agg.addAlert(makeAlert({ dispatch_run_id: 'run-A' }));
    agg.addAlert(makeAlert({ dispatch_run_id: 'run-B' }));

    const alerts = agg.getAlertsByRunId('run-A');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].dispatch_run_id).toBe('run-A');
  });

  it('should clear alerts', () => {
    agg.addAlert(makeAlert());
    agg.clearAlerts();
    expect(agg.alertCount()).toBe(0);
  });

  it('should return a copy of alerts (not a reference)', () => {
    agg.addAlert(makeAlert());
    const alerts = agg.getAlerts();
    alerts.pop();
    expect(agg.alertCount()).toBe(1);
  });
});

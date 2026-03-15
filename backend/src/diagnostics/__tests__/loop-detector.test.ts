import { describe, it, expect } from 'vitest';
import { LoopDetector } from '../loop-detector';
import type { AgentDiagnostics } from '../../schemas/agent-diagnostics';

function makeDiagnostics(overrides: Partial<AgentDiagnostics> = {}): AgentDiagnostics {
  return {
    worker_id: 'worker-1',
    worker_type: 'pentester',
    dispatch_run_id: 'run-001',
    started_at: '2026-03-14T10:00:00.000Z',
    updated_at: new Date().toISOString(), // fresh
    wall_clock_seconds: 30,
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

describe('LoopDetector', () => {
  const detector = new LoopDetector();

  describe('evaluate', () => {
    it('should return no reasons for healthy agent', () => {
      const diag = makeDiagnostics();
      expect(detector.evaluate(diag)).toEqual([]);
    });

    it('should detect trace length exceeded', () => {
      const diag = makeDiagnostics({ trace_length: 250 });
      const reasons = detector.evaluate(diag);
      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('Trace length 250');
    });

    it('should detect high repetition ratio', () => {
      const diag = makeDiagnostics({
        total_tool_calls: 100,
        repeated_calls: 50, // 50% > 40% threshold
      });
      const reasons = detector.evaluate(diag);
      expect(reasons.some(r => r.includes('Repetition ratio'))).toBe(true);
    });

    it('should not check repetition ratio with few tool calls', () => {
      const diag = makeDiagnostics({
        total_tool_calls: 5,
        repeated_calls: 4, // 80% but total < 10
      });
      const reasons = detector.evaluate(diag);
      expect(reasons.some(r => r.includes('Repetition ratio'))).toBe(false);
    });

    it('should detect consecutive error spiral', () => {
      const diag = makeDiagnostics({ consecutive_errors: 6 });
      const reasons = detector.evaluate(diag);
      expect(reasons.some(r => r.includes('consecutive errors'))).toBe(true);
    });

    it('should detect staleness', () => {
      const staleTime = new Date(Date.now() - 200_000).toISOString();
      const diag = makeDiagnostics({ updated_at: staleTime });
      const reasons = detector.evaluate(diag);
      expect(reasons.some(r => r.includes('Stale'))).toBe(true);
    });

    it('should detect wall clock exceeded', () => {
      const diag = makeDiagnostics({ wall_clock_seconds: 700 });
      const reasons = detector.evaluate(diag);
      expect(reasons.some(r => r.includes('Wall clock'))).toBe(true);
    });

    it('should detect multiple issues at once', () => {
      const diag = makeDiagnostics({
        trace_length: 250,
        wall_clock_seconds: 700,
        consecutive_errors: 6,
      });
      const reasons = detector.evaluate(diag);
      expect(reasons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy for normal agent', () => {
      const diag = makeDiagnostics();
      expect(detector.getHealthStatus(diag)).toBe('healthy');
    });

    it('should return warning when approaching trace threshold', () => {
      const diag = makeDiagnostics({ trace_length: 150 }); // 75% of 200
      expect(detector.getHealthStatus(diag)).toBe('warning');
    });

    it('should return warning when approaching wall clock threshold', () => {
      const diag = makeDiagnostics({ wall_clock_seconds: 450 }); // 75% of 600
      expect(detector.getHealthStatus(diag)).toBe('warning');
    });

    it('should return warning when approaching consecutive error threshold', () => {
      const diag = makeDiagnostics({ consecutive_errors: 4 }); // 80% of 5
      expect(detector.getHealthStatus(diag)).toBe('warning');
    });

    it('should return looping when threshold exceeded', () => {
      const diag = makeDiagnostics({ trace_length: 250 });
      expect(detector.getHealthStatus(diag)).toBe('looping');
    });
  });

  describe('buildAlert', () => {
    it('should return null for healthy agent', () => {
      const diag = makeDiagnostics();
      expect(detector.buildAlert(diag, false)).toBeNull();
    });

    it('should build alert for looping agent', () => {
      const diag = makeDiagnostics({ trace_length: 250 });
      const alert = detector.buildAlert(diag, false);
      expect(alert).not.toBeNull();
      expect(alert!.worker_id).toBe('worker-1');
      expect(alert!.worker_type).toBe('pentester');
      expect(alert!.reasons.length).toBeGreaterThan(0);
      expect(alert!.auto_killed).toBe(false);
      expect(alert!.diagnostics).toEqual(diag);
    });

    it('should set auto_killed flag', () => {
      const diag = makeDiagnostics({ trace_length: 250 });
      const alert = detector.buildAlert(diag, true);
      expect(alert!.auto_killed).toBe(true);
    });

    it('should include triggered_at timestamp', () => {
      const diag = makeDiagnostics({ trace_length: 250 });
      const alert = detector.buildAlert(diag, false);
      expect(alert!.triggered_at).toBeTruthy();
      // Should be a valid ISO date
      expect(new Date(alert!.triggered_at).toISOString()).toBe(alert!.triggered_at);
    });
  });

  describe('custom config', () => {
    it('should respect custom thresholds', () => {
      const strictDetector = new LoopDetector({
        max_trace_length: 50,
        max_wall_clock_seconds: 60,
      });

      const diag = makeDiagnostics({ trace_length: 55 });
      expect(strictDetector.getHealthStatus(diag)).toBe('looping');

      // Same value with default detector should be healthy
      expect(detector.getHealthStatus(diag)).toBe('healthy');
    });
  });
});

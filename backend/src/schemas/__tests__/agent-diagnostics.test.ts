import { describe, it, expect } from 'vitest';
import {
  AgentDiagnosticsSchema,
  LoopDetectionConfigSchema,
  LoopAlertSchema,
  DEFAULT_LOOP_DETECTION_CONFIG,
} from '../agent-diagnostics';

describe('AgentDiagnosticsSchema', () => {
  const validDiag = {
    worker_id: 'worker-1',
    worker_type: 'pentester' as const,
    dispatch_run_id: 'run-001',
    started_at: '2026-03-14T10:00:00.000Z',
    updated_at: '2026-03-14T10:01:00.000Z',
    wall_clock_seconds: 60,
    trace_length: 10,
    tool_calls: { bash: 5 },
    total_tool_calls: 5,
    lines_added: 10,
    lines_removed: 3,
    unique_files_touched: ['src/a.ts'],
    repeated_calls: 1,
    error_count: 0,
    consecutive_errors: 0,
    phase: 'attack',
    findings_so_far: 2,
    last_action: 'Testing endpoint',
  };

  it('should parse a valid diagnostics object', () => {
    const result = AgentDiagnosticsSchema.parse(validDiag);
    expect(result.worker_id).toBe('worker-1');
    expect(result.worker_type).toBe('pentester');
    expect(result.tool_calls).toEqual({ bash: 5 });
  });

  it('should accept constructor worker type', () => {
    const result = AgentDiagnosticsSchema.parse({ ...validDiag, worker_type: 'constructor' });
    expect(result.worker_type).toBe('constructor');
  });

  it('should reject invalid worker type', () => {
    expect(() => AgentDiagnosticsSchema.parse({ ...validDiag, worker_type: 'invalid' })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => AgentDiagnosticsSchema.parse({ worker_id: 'x' })).toThrow();
  });

  it('should accept empty tool_calls', () => {
    const result = AgentDiagnosticsSchema.parse({ ...validDiag, tool_calls: {} });
    expect(result.tool_calls).toEqual({});
  });

  it('should accept empty unique_files_touched', () => {
    const result = AgentDiagnosticsSchema.parse({ ...validDiag, unique_files_touched: [] });
    expect(result.unique_files_touched).toEqual([]);
  });
});

describe('LoopDetectionConfigSchema', () => {
  it('should parse with all defaults', () => {
    const result = LoopDetectionConfigSchema.parse({});
    expect(result.max_trace_length).toBe(200);
    expect(result.max_repetition_ratio).toBe(0.4);
    expect(result.max_consecutive_errors).toBe(5);
    expect(result.staleness_window_seconds).toBe(120);
    expect(result.max_wall_clock_seconds).toBe(600);
  });

  it('should override individual defaults', () => {
    const result = LoopDetectionConfigSchema.parse({ max_trace_length: 100 });
    expect(result.max_trace_length).toBe(100);
    expect(result.max_repetition_ratio).toBe(0.4); // still default
  });

  it('should have matching DEFAULT_LOOP_DETECTION_CONFIG', () => {
    expect(DEFAULT_LOOP_DETECTION_CONFIG.max_trace_length).toBe(200);
    expect(DEFAULT_LOOP_DETECTION_CONFIG.max_wall_clock_seconds).toBe(600);
  });
});

describe('LoopAlertSchema', () => {
  const validAlert = {
    worker_id: 'worker-1',
    worker_type: 'pentester' as const,
    dispatch_run_id: 'run-001',
    triggered_at: '2026-03-14T10:05:00.000Z',
    reasons: ['Trace length exceeded'],
    diagnostics: {
      worker_id: 'worker-1',
      worker_type: 'pentester' as const,
      dispatch_run_id: 'run-001',
      started_at: '2026-03-14T10:00:00.000Z',
      updated_at: '2026-03-14T10:05:00.000Z',
      wall_clock_seconds: 300,
      trace_length: 210,
      tool_calls: {},
      total_tool_calls: 210,
      lines_added: 0,
      lines_removed: 0,
      unique_files_touched: [],
      repeated_calls: 50,
      error_count: 3,
      consecutive_errors: 0,
      phase: 'attack',
      findings_so_far: 0,
      last_action: 'Retrying request',
    },
    auto_killed: false,
  };

  it('should parse a valid loop alert', () => {
    const result = LoopAlertSchema.parse(validAlert);
    expect(result.worker_id).toBe('worker-1');
    expect(result.reasons).toHaveLength(1);
    expect(result.auto_killed).toBe(false);
  });

  it('should validate nested diagnostics', () => {
    const bad = { ...validAlert, diagnostics: { worker_id: 'x' } };
    expect(() => LoopAlertSchema.parse(bad)).toThrow();
  });

  it('should accept multiple reasons', () => {
    const result = LoopAlertSchema.parse({
      ...validAlert,
      reasons: ['Trace exceeded', 'Wall clock exceeded', 'Error spiral'],
    });
    expect(result.reasons).toHaveLength(3);
  });
});

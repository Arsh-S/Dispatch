import { describe, it, expect, beforeEach, vi } from 'vitest';
import { forwardDiagnostics, forwardLoopAlert, clearThrottle } from '../diagnostics-forwarder';
import * as client from '../client';
import type { AgentDiagnostics, LoopAlert } from '../../../schemas/agent-diagnostics';

vi.mock('../client', () => ({
  isEnabled: vi.fn(() => true),
  getConfig: vi.fn(() => ({
    apiKey: 'test-key',
    site: 'datadoghq.com',
    env: 'test',
    service: 'dispatch-scanner',
  })),
  sendMetrics: vi.fn(),
  sendEvent: vi.fn(),
}));

function makeDiag(overrides: Partial<AgentDiagnostics> = {}): AgentDiagnostics {
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
    lines_added: 5,
    lines_removed: 2,
    unique_files_touched: ['src/a.ts'],
    repeated_calls: 1,
    error_count: 0,
    consecutive_errors: 0,
    phase: 'attack',
    findings_so_far: 2,
    last_action: 'Testing',
    ...overrides,
  };
}

describe('diagnostics-forwarder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearThrottle('worker-1');
    clearThrottle('worker-2');
  });

  describe('forwardDiagnostics', () => {
    it('should send metrics to Datadog', () => {
      forwardDiagnostics(makeDiag());

      expect(client.sendMetrics).toHaveBeenCalledTimes(1);
      const payload = (client.sendMetrics as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(payload.series.length).toBeGreaterThan(0);
      expect(payload.series[0].metric).toContain('dispatch.worker.');
    });

    it('should include correct tags', () => {
      forwardDiagnostics(makeDiag());

      const payload = (client.sendMetrics as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const tags = payload.series[0].tags;
      expect(tags).toContain('worker_id:worker-1');
      expect(tags).toContain('worker_type:pentester');
      expect(tags).toContain('dispatch_run_id:run-001');
      expect(tags).toContain('phase:attack');
      expect(tags).toContain('env:test');
    });

    it('should throttle repeated calls for same worker', () => {
      forwardDiagnostics(makeDiag());
      forwardDiagnostics(makeDiag());
      forwardDiagnostics(makeDiag());

      expect(client.sendMetrics).toHaveBeenCalledTimes(1);
    });

    it('should not throttle different workers', () => {
      forwardDiagnostics(makeDiag({ worker_id: 'worker-1' }));
      forwardDiagnostics(makeDiag({ worker_id: 'worker-2' }));

      expect(client.sendMetrics).toHaveBeenCalledTimes(2);
    });

    it('should not send if Datadog is disabled', () => {
      vi.mocked(client.isEnabled).mockReturnValueOnce(false);
      forwardDiagnostics(makeDiag());
      expect(client.sendMetrics).not.toHaveBeenCalled();
    });

    it('should send correct metric names', () => {
      forwardDiagnostics(makeDiag());

      const payload = (client.sendMetrics as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const metricNames = payload.series.map((s: { metric: string }) => s.metric);
      expect(metricNames).toContain('dispatch.worker.wall_clock_seconds');
      expect(metricNames).toContain('dispatch.worker.trace_length');
      expect(metricNames).toContain('dispatch.worker.total_tool_calls');
      expect(metricNames).toContain('dispatch.worker.error_count');
      expect(metricNames).toContain('dispatch.worker.findings_so_far');
      expect(metricNames).toContain('dispatch.worker.files_touched');
    });
  });

  describe('forwardLoopAlert', () => {
    const makeAlert = (): LoopAlert => ({
      worker_id: 'worker-1',
      worker_type: 'pentester',
      dispatch_run_id: 'run-001',
      triggered_at: '2026-03-14T10:05:00.000Z',
      reasons: ['Trace length exceeded', 'Wall clock exceeded'],
      diagnostics: makeDiag(),
      auto_killed: false,
    });

    it('should send an event to Datadog', () => {
      forwardLoopAlert(makeAlert());
      expect(client.sendEvent).toHaveBeenCalledTimes(1);
    });

    it('should include reasons in event text', () => {
      forwardLoopAlert(makeAlert());
      const event = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(event.text).toContain('Trace length exceeded');
      expect(event.text).toContain('Wall clock exceeded');
    });

    it('should set warning alert type', () => {
      forwardLoopAlert(makeAlert());
      const event = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(event.alert_type).toBe('warning');
    });

    it('should not send if Datadog is disabled', () => {
      vi.mocked(client.isEnabled).mockReturnValueOnce(false);
      forwardLoopAlert(makeAlert());
      expect(client.sendEvent).not.toHaveBeenCalled();
    });
  });

  describe('clearThrottle', () => {
    it('should allow forwarding again after clear', () => {
      forwardDiagnostics(makeDiag());
      expect(client.sendMetrics).toHaveBeenCalledTimes(1);

      // Throttled
      forwardDiagnostics(makeDiag());
      expect(client.sendMetrics).toHaveBeenCalledTimes(1);

      // Clear throttle and try again
      clearThrottle('worker-1');
      forwardDiagnostics(makeDiag());
      expect(client.sendMetrics).toHaveBeenCalledTimes(2);
    });
  });
});

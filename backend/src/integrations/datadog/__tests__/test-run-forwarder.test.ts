import { describe, it, expect, beforeEach, vi } from 'vitest';
import { forwardTestRunToDatadog } from '../test-run-forwarder';
import * as client from '../client';
import type { TestRunReport } from '../../../schemas/test-run-report';

vi.mock('../client', () => ({
  isEnabled: vi.fn(() => true),
  sendEvent: vi.fn(),
  sendMetrics: vi.fn(),
}));

function makeReport(overrides: Partial<TestRunReport> = {}): TestRunReport {
  return {
    dispatch_run_id: 'run-test-001',
    worker_id: 'test-runner-abc123',
    completed_at: '2026-03-15T12:00:00.000Z',
    status: 'passed',
    exit_code: 0,
    duration_seconds: 12.5,
    command: 'pnpm test',
    stdout: '',
    stderr: '',
    parsed_summary: { passed: 10, failed: 0, total: 10, framework: 'vitest' },
    ...overrides,
  };
}

describe('test-run-forwarder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.isEnabled).mockReturnValue(true);
  });

  it('should not send when Datadog is disabled', async () => {
    vi.mocked(client.isEnabled).mockReturnValue(false);
    await forwardTestRunToDatadog(makeReport());

    expect(client.sendEvent).not.toHaveBeenCalled();
    expect(client.sendMetrics).not.toHaveBeenCalled();
  });

  it('should send event and metrics when Datadog is enabled', async () => {
    await forwardTestRunToDatadog(makeReport());

    expect(client.sendEvent).toHaveBeenCalledTimes(1);
    expect(client.sendMetrics).toHaveBeenCalledTimes(1);
  });

  it('should include report data in event', async () => {
    const report = makeReport();
    await forwardTestRunToDatadog(report);

    const event = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(event.title).toContain(report.worker_id);
    expect(event.text).toContain(report.status);
    expect(event.text).toContain(String(report.duration_seconds));
    expect(event.text).toContain(report.command);
    expect(event.text).toContain('passed: 10');
    expect(event.text).toContain('failed: 0');
    expect(event.text).toContain('total: 10');
    expect(event.text).toContain('framework: vitest');
  });

  it('should include correct tags in event', async () => {
    const report = makeReport();
    await forwardTestRunToDatadog(report);

    const event = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(event.tags).toContain(`dispatch_run_id:${report.dispatch_run_id}`);
    expect(event.tags).toContain(`dispatch_worker_id:${report.worker_id}`);
    expect(event.tags).toContain(`status:${report.status}`);
    expect(event.tags).toContain('source:test-runner');
  });

  it('should set success alert type for passed status', async () => {
    await forwardTestRunToDatadog(makeReport({ status: 'passed' }));

    const event = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(event.alert_type).toBe('success');
  });

  it('should set error alert type for failed status', async () => {
    await forwardTestRunToDatadog(makeReport({ status: 'failed' }));

    const event = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(event.alert_type).toBe('error');
  });

  it('should send correct metrics', async () => {
    const report = makeReport({ status: 'passed', duration_seconds: 5.2 });
    await forwardTestRunToDatadog(report);

    const payload = (client.sendMetrics as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.series.length).toBe(2);

    const statusMetric = payload.series.find((s: { metric: string }) => s.metric === 'dispatch.test_run.status');
    expect(statusMetric).toBeDefined();
    expect(statusMetric.points[0].value).toBe(1);

    const durationMetric = payload.series.find((s: { metric: string }) => s.metric === 'dispatch.test_run.duration_seconds');
    expect(durationMetric).toBeDefined();
    expect(durationMetric.points[0].value).toBe(5.2);
  });

  it('should send status 0 for failed run', async () => {
    await forwardTestRunToDatadog(makeReport({ status: 'failed' }));

    const payload = (client.sendMetrics as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const statusMetric = payload.series.find((s: { metric: string }) => s.metric === 'dispatch.test_run.status');
    expect(statusMetric.points[0].value).toBe(0);
  });

  it('should handle report without parsed_summary', async () => {
    const report = makeReport({ parsed_summary: undefined });
    await forwardTestRunToDatadog(report);

    const event = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(event.text).toContain(report.status);
    expect(event.text).not.toContain('Parsed summary');
  });
});

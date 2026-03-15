/**
 * Forward TestRunReport to Datadog when configured.
 * No-op when DATADOG_API_KEY is absent — fails gracefully.
 */

import type { TestRunReport } from '../../schemas/test-run-report.js';
import { isEnabled, sendEvent, sendMetrics } from './client.js';
import type { DatadogEvent, DatadogMetricSeries } from './types.js';

export async function forwardTestRunToDatadog(report: TestRunReport): Promise<void> {
  if (!isEnabled()) return;

  const summaryLines: string[] = [
    `**Status:** ${report.status}`,
    `**Duration:** ${report.duration_seconds}s`,
    `**Command:** ${report.command}`,
    `**Exit code:** ${report.exit_code ?? 'N/A'}`,
  ];

  if (report.parsed_summary) {
    const s = report.parsed_summary;
    const parts: string[] = [];
    if (s.passed !== undefined) parts.push(`passed: ${s.passed}`);
    if (s.failed !== undefined) parts.push(`failed: ${s.failed}`);
    if (s.skipped !== undefined) parts.push(`skipped: ${s.skipped}`);
    if (s.total !== undefined) parts.push(`total: ${s.total}`);
    if (s.framework) parts.push(`framework: ${s.framework}`);
    if (parts.length > 0) {
      summaryLines.push(`**Parsed summary:** ${parts.join(', ')}`);
    }
  }

  const tags = [
    `dispatch_run_id:${report.dispatch_run_id}`,
    `dispatch_worker_id:${report.worker_id}`,
    `status:${report.status}`,
    'source:test-runner',
  ];

  let alertType: DatadogEvent['alert_type'] = 'info';
  if (report.status === 'passed') alertType = 'success';
  else if (report.status === 'failed' || report.status === 'error') alertType = 'error';
  else if (report.status === 'timeout') alertType = 'warning';

  const event: DatadogEvent = {
    title: `Dispatch Test Run: ${report.worker_id}`,
    text: summaryLines.join('\n'),
    tags,
    alert_type: alertType,
    source_type_name: 'dispatch',
  };

  const now = Math.floor(Date.now() / 1000);
  const metricTags = [
    `dispatch_run_id:${report.dispatch_run_id}`,
    `dispatch_worker_id:${report.worker_id}`,
    `status:${report.status}`,
  ];

  const statusValue = report.status === 'passed' ? 1 : 0;

  const series: DatadogMetricSeries[] = [
    { metric: 'dispatch.test_run.status', type: 1, points: [{ timestamp: now, value: statusValue }], tags: metricTags },
    { metric: 'dispatch.test_run.duration_seconds', type: 1, points: [{ timestamp: now, value: report.duration_seconds }], tags: metricTags },
  ];

  await Promise.all([
    sendEvent(event),
    sendMetrics({ series }),
  ]);
}

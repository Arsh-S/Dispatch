import type { AgentDiagnostics, LoopAlert } from '../../schemas/agent-diagnostics.js';
import type { DatadogMetricSeries } from './types.js';
import { isEnabled, sendMetrics, sendEvent, getConfig } from './client.js';

const lastForwardedAt: Map<string, number> = new Map();
const THROTTLE_MS = 30_000;

/**
 * Forward agent diagnostics as Datadog gauge metrics.
 * Throttled to at most one submission per worker per 30 seconds.
 */
export function forwardDiagnostics(diag: AgentDiagnostics): void {
  if (!isEnabled()) return;

  const now = Date.now();
  const lastTime = lastForwardedAt.get(diag.worker_id) ?? 0;
  if (now - lastTime < THROTTLE_MS) return;
  lastForwardedAt.set(diag.worker_id, now);

  const cfg = getConfig()!;
  const tags = [
    `worker_id:${diag.worker_id}`,
    `worker_type:${diag.worker_type}`,
    `dispatch_run_id:${diag.dispatch_run_id}`,
    `phase:${diag.phase}`,
    `env:${cfg.env}`,
  ];

  const timestamp = Math.floor(now / 1000);

  const series: DatadogMetricSeries[] = [
    {
      metric: 'dispatch.worker.wall_clock_seconds',
      type: 1, // gauge
      points: [{ timestamp, value: diag.wall_clock_seconds }],
      tags,
    },
    {
      metric: 'dispatch.worker.trace_length',
      type: 1,
      points: [{ timestamp, value: diag.trace_length }],
      tags,
    },
    {
      metric: 'dispatch.worker.total_tool_calls',
      type: 1,
      points: [{ timestamp, value: diag.total_tool_calls }],
      tags,
    },
    {
      metric: 'dispatch.worker.repeated_calls',
      type: 1,
      points: [{ timestamp, value: diag.repeated_calls }],
      tags,
    },
    {
      metric: 'dispatch.worker.error_count',
      type: 1,
      points: [{ timestamp, value: diag.error_count }],
      tags,
    },
    {
      metric: 'dispatch.worker.consecutive_errors',
      type: 1,
      points: [{ timestamp, value: diag.consecutive_errors }],
      tags,
    },
    {
      metric: 'dispatch.worker.lines_added',
      type: 1,
      points: [{ timestamp, value: diag.lines_added }],
      tags,
    },
    {
      metric: 'dispatch.worker.lines_removed',
      type: 1,
      points: [{ timestamp, value: diag.lines_removed }],
      tags,
    },
    {
      metric: 'dispatch.worker.findings_so_far',
      type: 1,
      points: [{ timestamp, value: diag.findings_so_far }],
      tags,
    },
    {
      metric: 'dispatch.worker.files_touched',
      type: 1,
      points: [{ timestamp, value: diag.unique_files_touched.length }],
      tags,
    },
  ];

  sendMetrics({ series });
}

/**
 * Forward a loop alert as a Datadog event.
 */
export function forwardLoopAlert(alert: LoopAlert): void {
  if (!isEnabled()) return;

  sendEvent({
    title: `Dispatch Loop Detected: ${alert.worker_id}`,
    text: [
      `Worker ${alert.worker_id} (${alert.worker_type}) triggered loop detection.`,
      '',
      '**Reasons:**',
      ...alert.reasons.map(r => `- ${r}`),
      '',
      `Auto-killed: ${alert.auto_killed}`,
      `Wall clock: ${alert.diagnostics.wall_clock_seconds}s`,
      `Trace length: ${alert.diagnostics.trace_length}`,
      `Total tool calls: ${alert.diagnostics.total_tool_calls}`,
    ].join('\n'),
    tags: [
      `worker_id:${alert.worker_id}`,
      `worker_type:${alert.worker_type}`,
      `dispatch_run_id:${alert.dispatch_run_id}`,
      `auto_killed:${alert.auto_killed}`,
    ],
    alert_type: 'warning',
    source_type_name: 'dispatch',
  });
}

/**
 * Clean up throttle tracking for a completed worker.
 */
export function clearThrottle(workerId: string): void {
  lastForwardedAt.delete(workerId);
}

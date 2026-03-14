import { DispatchLogEntry } from '../../middleware/types.js';
import { DatadogLogPayload } from './types.js';
import { isEnabled, sendLogs, getConfig } from './client.js';

const buffer: DatadogLogPayload[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

const MAX_BATCH = 100;
const FLUSH_INTERVAL_MS = 5_000;

function toDatadogPayload(
  entry: DispatchLogEntry,
  runId: string,
  workerId: string,
): DatadogLogPayload {
  const cfg = getConfig()!;
  const tags = [
    `dispatch_run_id:${runId}`,
    `dispatch_worker_id:${workerId}`,
    `source:${entry.source}`,
    `env:${cfg.env}`,
  ].join(',');

  const levelMap: Record<string, string> = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
  };

  return {
    message: entry.stack ? `${entry.message}\n${entry.stack}` : entry.message,
    ddsource: entry.source,
    ddtags: tags,
    hostname: `dispatch-worker-${workerId}`,
    service: cfg.service,
    status: levelMap[entry.level] || 'info',
  };
}

export function enqueue(entry: DispatchLogEntry, runId: string, workerId: string): void {
  if (!isEnabled()) return;

  buffer.push(toDatadogPayload(entry, runId, workerId));

  if (buffer.length >= MAX_BATCH) {
    flush();
  }
}

export function flush(): void {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  sendLogs(batch);
}

export function startAutoFlush(): void {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

export function shutdown(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flush();
}

export function getBufferLength(): number {
  return buffer.length;
}

import { DispatchLogEntry } from '../../middleware/types.js';
import { isReadEnabled, searchLogs, getConfig } from './client.js';
import { DatadogLogResult, DatadogLogSearchRequest } from './types.js';

export interface LogReaderQuery {
  workerId: string;
  runId?: string;
  level?: string;
  since?: string;
  limit?: number;
}

function buildSearchQuery(q: LogReaderQuery): string {
  const cfg = getConfig()!;
  const parts = [
    `service:${cfg.service}`,
    `@dispatch_worker_id:${q.workerId}`,
  ];
  if (q.runId) parts.push(`@dispatch_run_id:${q.runId}`);
  if (q.level) parts.push(`status:${q.level.toLowerCase()}`);
  return parts.join(' ');
}

const ddStatusToLevel: Record<string, DispatchLogEntry['level']> = {
  error: 'ERROR',
  warn: 'WARN',
  warning: 'WARN',
  info: 'INFO',
  debug: 'DEBUG',
};

function toDispatchLogEntry(result: DatadogLogResult): DispatchLogEntry {
  const attrs = result.attributes;
  return {
    timestamp: attrs.timestamp,
    level: ddStatusToLevel[attrs.status] || 'INFO',
    source: (attrs.attributes?.ddsource as string) || 'datadog',
    message: attrs.message,
    stack: attrs.attributes?.error?.stack as string | undefined,
    dispatch_worker_id: attrs.attributes?.dispatch_worker_id as string | undefined,
    dispatch_run_id: attrs.attributes?.dispatch_run_id as string | undefined,
  };
}

export async function queryLogs(q: LogReaderQuery): Promise<DispatchLogEntry[] | null> {
  if (!isReadEnabled()) return null;

  const request: DatadogLogSearchRequest = {
    filter: {
      query: buildSearchQuery(q),
      from: q.since || new Date(Date.now() - 3600_000).toISOString(),
    },
    page: { limit: q.limit || 100 },
    sort: '-timestamp',
  };

  const response = await searchLogs(request);
  if (!response) return null;

  return response.data.map(toDispatchLogEntry);
}

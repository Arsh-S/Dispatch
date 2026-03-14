import { Request, Response, NextFunction } from 'express';
import { DispatchLogEntry, DispatchLogResponse } from './types.js';
import { isEnabled, isReadEnabled, initDatadog } from '../integrations/datadog/client.js';
import { enqueue, startAutoFlush, shutdown as shutdownForwarder } from '../integrations/datadog/log-forwarder.js';
import { queryLogs } from '../integrations/datadog/log-reader.js';

// In-memory log store keyed by worker_id
const logStore = new Map<string, DispatchLogEntry[]>();

initDatadog();
if (isEnabled()) {
  startAutoFlush();
  process.on('beforeExit', shutdownForwarder);
}

export function dispatchLogMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Handle log query endpoint
    if (req.path === '/_dispatch/logs' && req.method === 'GET') {
      return handleLogQuery(req, res);
    }

    const workerId = req.headers['x-dispatch-worker-id'] as string;
    const runId = req.headers['x-dispatch-run-id'] as string;

    // No-op if no dispatch headers
    if (!workerId) {
      return next();
    }

    // Initialize log array for this worker if needed
    if (!logStore.has(workerId)) {
      logStore.set(workerId, []);
    }

    const workerLogs = logStore.get(workerId)!;

    // Capture console methods during this request
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;

    const addLog = (level: DispatchLogEntry['level'], source: string, ...args: unknown[]) => {
      const entry: DispatchLogEntry = {
        timestamp: new Date().toISOString(),
        level,
        source,
        message: args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '),
        dispatch_worker_id: workerId,
        dispatch_run_id: runId,
      };
      workerLogs.push(entry);
      enqueue(entry, runId, workerId);
    };

    console.log = (...args: unknown[]) => { addLog('INFO', 'console', ...args); origLog(...args); };
    console.error = (...args: unknown[]) => { addLog('ERROR', 'console', ...args); origError(...args); };
    console.warn = (...args: unknown[]) => { addLog('WARN', 'console', ...args); origWarn(...args); };

    // Capture response status
    const origEnd = res.end;
    res.end = function (this: Response, ...args: Parameters<Response['end']>) {
      addLog('INFO', 'express', `${req.method} ${req.path} — ${res.statusCode}`);
      // Restore console
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
      return origEnd.apply(this, args);
    } as Response['end'];

    // Capture unhandled errors on the response stream
    res.on('error', (err: Error) => {
      const entry: DispatchLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        source: 'express',
        message: err.message,
        stack: err.stack,
        dispatch_worker_id: workerId,
        dispatch_run_id: runId,
      };
      workerLogs.push(entry);
      enqueue(entry, runId, workerId);
    });

    next();
  };
}

async function handleLogQuery(req: Request, res: Response) {
  const workerId = req.query.worker_id as string;
  if (!workerId) {
    return res.status(400).json({ error: 'worker_id query parameter is required' });
  }

  const runId = req.query.run_id as string | undefined;
  const level = req.query.level as string | undefined;
  const since = req.query.since as string | undefined;
  const limit = parseInt(req.query.limit as string) || 100;

  // If Datadog read is available, proxy the query there
  if (isReadEnabled()) {
    try {
      const ddLogs = await queryLogs({ workerId, runId, level, since, limit });
      if (ddLogs !== null) {
        const response: DispatchLogResponse = {
          worker_id: workerId,
          log_count: ddLogs.length,
          logs: ddLogs,
        };
        return res.json(response);
      }
    } catch {
      // Fall through to in-memory on Datadog read failure
    }
  }

  // Fallback: serve from in-memory store
  let logs = logStore.get(workerId) || [];

  if (level) {
    logs = logs.filter(l => l.level === level.toUpperCase());
  }

  if (since) {
    const sinceDate = new Date(since);
    logs = logs.filter(l => new Date(l.timestamp) > sinceDate);
  }

  if (runId) {
    logs = logs.filter(l => l.dispatch_run_id === runId);
  }

  logs = logs.slice(-limit);

  const response: DispatchLogResponse = {
    worker_id: workerId,
    log_count: logs.length,
    logs,
  };

  res.json(response);
}

// Export for clearing logs (useful for testing)
export function clearDispatchLogs(workerId?: string) {
  if (workerId) {
    logStore.delete(workerId);
  } else {
    logStore.clear();
  }
}

// Export logStore for testing inspection
export { logStore };

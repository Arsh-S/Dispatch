import { Request, Response, NextFunction } from 'express';
import { DispatchLogEntry, DispatchLogResponse } from './types.js';

// In-memory log store keyed by worker_id
const logStore = new Map<string, DispatchLogEntry[]>();

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
      workerLogs.push({
        timestamp: new Date().toISOString(),
        level,
        source,
        message: args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '),
      });
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
      workerLogs.push({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        source: 'express',
        message: err.message,
        stack: err.stack,
      });
    });

    next();
  };
}

function handleLogQuery(req: Request, res: Response) {
  const workerId = req.query.worker_id as string;
  if (!workerId) {
    return res.status(400).json({ error: 'worker_id query parameter is required' });
  }

  let logs = logStore.get(workerId) || [];

  // Filter by level
  const level = req.query.level as string;
  if (level) {
    logs = logs.filter(l => l.level === level.toUpperCase());
  }

  // Filter by since
  const since = req.query.since as string;
  if (since) {
    const sinceDate = new Date(since);
    logs = logs.filter(l => new Date(l.timestamp) > sinceDate);
  }

  // Limit
  const limit = parseInt(req.query.limit as string) || 100;
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

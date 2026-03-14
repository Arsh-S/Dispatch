import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Request, Response } from 'express';
import http from 'http';

// Mock Datadog modules to prevent initDatadog/startAutoFlush side effects at module load
vi.mock('../../integrations/datadog/client.js', () => ({
  initDatadog: vi.fn(),
  isEnabled: vi.fn(() => false),
  isReadEnabled: vi.fn(() => false),
}));
vi.mock('../../integrations/datadog/log-forwarder.js', () => ({
  enqueue: vi.fn(),
  startAutoFlush: vi.fn(),
  shutdown: vi.fn(),
}));
vi.mock('../../integrations/datadog/log-reader.js', () => ({
  queryLogs: vi.fn(),
}));

import { dispatchLogMiddleware, clearDispatchLogs, logStore } from '../dispatch-log-middleware.js';

function createTestApp() {
  const app = express();
  app.use(dispatchLogMiddleware());

  // A route that logs things
  app.get('/test', (req: Request, res: Response) => {
    console.log('test log message');
    console.warn('test warning');
    console.error('test error');
    res.status(200).json({ ok: true });
  });

  // A route that does nothing special
  app.get('/silent', (_req: Request, res: Response) => {
    res.status(200).json({ silent: true });
  });

  return app;
}

function makeRequest(
  server: http.Server,
  path: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode!, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode!, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('dispatchLogMiddleware', () => {
  let server: http.Server;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    clearDispatchLogs();
    app = createTestApp();
  });

  function startServer(): Promise<http.Server> {
    return new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
  }

  function stopServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (server) {
        server.close((err) => (err ? reject(err) : resolve()));
      } else {
        resolve();
      }
    });
  }

  it('should pass through requests without dispatch headers', async () => {
    await startServer();
    try {
      const res = await makeRequest(server, '/silent');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ silent: true });
      // No logs should be stored
      expect(logStore.size).toBe(0);
    } finally {
      await stopServer();
    }
  });

  it('should capture console logs for requests with dispatch headers', async () => {
    await startServer();
    try {
      await makeRequest(server, '/test', {
        'x-dispatch-worker-id': 'worker-1',
        'x-dispatch-run-id': 'run-1',
      });

      const logs = logStore.get('worker-1')!;
      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThanOrEqual(4); // 3 console calls + 1 response status

      const infoLogs = logs.filter((l) => l.level === 'INFO' && l.source === 'console');
      expect(infoLogs.some((l) => l.message === 'test log message')).toBe(true);

      const warnLogs = logs.filter((l) => l.level === 'WARN');
      expect(warnLogs.some((l) => l.message === 'test warning')).toBe(true);

      const errorLogs = logs.filter((l) => l.level === 'ERROR');
      expect(errorLogs.some((l) => l.message === 'test error')).toBe(true);

      // Should have express response log
      const expressLogs = logs.filter((l) => l.source === 'express');
      expect(expressLogs.some((l) => l.message.includes('200'))).toBe(true);
    } finally {
      await stopServer();
    }
  });

  it('should return logs via /_dispatch/logs endpoint', async () => {
    await startServer();
    try {
      // First generate some logs
      await makeRequest(server, '/test', {
        'x-dispatch-worker-id': 'worker-2',
        'x-dispatch-run-id': 'run-2',
      });

      // Query logs
      const res = await makeRequest(server, '/_dispatch/logs?worker_id=worker-2');
      expect(res.status).toBe(200);
      expect(res.body.worker_id).toBe('worker-2');
      expect(res.body.log_count).toBeGreaterThan(0);
      expect(Array.isArray(res.body.logs)).toBe(true);
    } finally {
      await stopServer();
    }
  });

  it('should return 400 if worker_id is missing from log query', async () => {
    await startServer();
    try {
      const res = await makeRequest(server, '/_dispatch/logs');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('worker_id query parameter is required');
    } finally {
      await stopServer();
    }
  });

  it('should filter logs by level', async () => {
    await startServer();
    try {
      await makeRequest(server, '/test', {
        'x-dispatch-worker-id': 'worker-3',
        'x-dispatch-run-id': 'run-3',
      });

      const res = await makeRequest(server, '/_dispatch/logs?worker_id=worker-3&level=ERROR');
      expect(res.status).toBe(200);
      expect(res.body.logs.every((l: any) => l.level === 'ERROR')).toBe(true);
      expect(res.body.log_count).toBeGreaterThan(0);
    } finally {
      await stopServer();
    }
  });

  it('should filter logs by since timestamp', async () => {
    await startServer();
    try {
      const beforeTime = new Date().toISOString();
      // Small delay to ensure timestamps differ
      await new Promise((r) => setTimeout(r, 10));

      await makeRequest(server, '/test', {
        'x-dispatch-worker-id': 'worker-4',
        'x-dispatch-run-id': 'run-4',
      });

      const res = await makeRequest(
        server,
        `/_dispatch/logs?worker_id=worker-4&since=${encodeURIComponent(beforeTime)}`
      );
      expect(res.status).toBe(200);
      expect(res.body.log_count).toBeGreaterThan(0);
      // All returned logs should be after 'since'
      for (const log of res.body.logs) {
        expect(new Date(log.timestamp).getTime()).toBeGreaterThan(new Date(beforeTime).getTime());
      }
    } finally {
      await stopServer();
    }
  });

  it('should respect limit parameter', async () => {
    await startServer();
    try {
      await makeRequest(server, '/test', {
        'x-dispatch-worker-id': 'worker-5',
        'x-dispatch-run-id': 'run-5',
      });

      const res = await makeRequest(server, '/_dispatch/logs?worker_id=worker-5&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.log_count).toBeLessThanOrEqual(2);
      expect(res.body.logs.length).toBeLessThanOrEqual(2);
    } finally {
      await stopServer();
    }
  });

  it('should return empty logs for unknown worker_id', async () => {
    await startServer();
    try {
      const res = await makeRequest(server, '/_dispatch/logs?worker_id=nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.worker_id).toBe('nonexistent');
      expect(res.body.log_count).toBe(0);
      expect(res.body.logs).toEqual([]);
    } finally {
      await stopServer();
    }
  });

  it('should store log entries with correct structure', async () => {
    await startServer();
    try {
      await makeRequest(server, '/test', {
        'x-dispatch-worker-id': 'worker-6',
        'x-dispatch-run-id': 'run-6',
      });

      const logs = logStore.get('worker-6')!;
      for (const log of logs) {
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('level');
        expect(log).toHaveProperty('source');
        expect(log).toHaveProperty('message');
        expect(['ERROR', 'WARN', 'INFO', 'DEBUG']).toContain(log.level);
        // timestamp should be valid ISO string
        expect(new Date(log.timestamp).toISOString()).toBe(log.timestamp);
      }
    } finally {
      await stopServer();
    }
  });

  it('clearDispatchLogs should clear logs for specific worker', () => {
    logStore.set('w1', [{ timestamp: '', level: 'INFO', source: '', message: '' }]);
    logStore.set('w2', [{ timestamp: '', level: 'INFO', source: '', message: '' }]);

    clearDispatchLogs('w1');
    expect(logStore.has('w1')).toBe(false);
    expect(logStore.has('w2')).toBe(true);
  });

  it('clearDispatchLogs should clear all logs when no worker specified', () => {
    logStore.set('w1', [{ timestamp: '', level: 'INFO', source: '', message: '' }]);
    logStore.set('w2', [{ timestamp: '', level: 'INFO', source: '', message: '' }]);

    clearDispatchLogs();
    expect(logStore.size).toBe(0);
  });
});

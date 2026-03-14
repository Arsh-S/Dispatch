import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../client.js', () => ({
  isReadEnabled: vi.fn(() => true),
  getConfig: vi.fn(() => ({
    apiKey: 'test-key',
    applicationKey: 'app-key',
    site: 'datadoghq.com',
    env: 'test',
    service: 'dispatch-scanner',
  })),
  searchLogs: vi.fn(),
}));

import { queryLogs } from '../log-reader.js';
import { searchLogs, isReadEnabled } from '../client.js';

const mockSearchLogs = vi.mocked(searchLogs);
const mockIsReadEnabled = vi.mocked(isReadEnabled);

describe('log-reader', () => {
  beforeEach(() => {
    mockSearchLogs.mockReset();
    mockIsReadEnabled.mockReturnValue(true);
  });

  it('returns null when read is not enabled', async () => {
    mockIsReadEnabled.mockReturnValue(false);
    const result = await queryLogs({ workerId: 'w1' });
    expect(result).toBeNull();
  });

  it('builds search query with worker_id', async () => {
    mockSearchLogs.mockResolvedValueOnce({ data: [], meta: {} });
    await queryLogs({ workerId: 'worker-1' });

    expect(mockSearchLogs).toHaveBeenCalledOnce();
    const request = mockSearchLogs.mock.calls[0][0];
    expect(request.filter.query).toContain('@dispatch_worker_id:worker-1');
    expect(request.filter.query).toContain('service:dispatch-scanner');
  });

  it('includes run_id in query when provided', async () => {
    mockSearchLogs.mockResolvedValueOnce({ data: [], meta: {} });
    await queryLogs({ workerId: 'w1', runId: 'run-42' });

    const request = mockSearchLogs.mock.calls[0][0];
    expect(request.filter.query).toContain('@dispatch_run_id:run-42');
  });

  it('includes level filter in query', async () => {
    mockSearchLogs.mockResolvedValueOnce({ data: [], meta: {} });
    await queryLogs({ workerId: 'w1', level: 'ERROR' });

    const request = mockSearchLogs.mock.calls[0][0];
    expect(request.filter.query).toContain('status:error');
  });

  it('maps Datadog results to DispatchLogEntry', async () => {
    mockSearchLogs.mockResolvedValueOnce({
      data: [
        {
          id: 'abc',
          type: 'log',
          attributes: {
            timestamp: '2026-03-14T12:00:00Z',
            status: 'error',
            message: 'QueryFailedError: syntax error',
            attributes: {
              ddsource: 'pg',
              dispatch_worker_id: 'w1',
              dispatch_run_id: 'r1',
              error: { stack: 'Error: ...\n  at db.ts:12' },
            },
            tags: ['dispatch_worker_id:w1'],
          },
        },
      ],
      meta: {},
    });

    const logs = await queryLogs({ workerId: 'w1' });
    expect(logs).toHaveLength(1);
    expect(logs![0].level).toBe('ERROR');
    expect(logs![0].source).toBe('pg');
    expect(logs![0].message).toBe('QueryFailedError: syntax error');
    expect(logs![0].stack).toBe('Error: ...\n  at db.ts:12');
    expect(logs![0].dispatch_worker_id).toBe('w1');
    expect(logs![0].dispatch_run_id).toBe('r1');
  });

  it('returns null when searchLogs fails', async () => {
    mockSearchLogs.mockResolvedValueOnce(null);
    const result = await queryLogs({ workerId: 'w1' });
    expect(result).toBeNull();
  });

  it('respects limit parameter', async () => {
    mockSearchLogs.mockResolvedValueOnce({ data: [], meta: {} });
    await queryLogs({ workerId: 'w1', limit: 50 });

    const request = mockSearchLogs.mock.calls[0][0];
    expect(request.page?.limit).toBe(50);
  });

  it('uses since parameter for filter.from', async () => {
    mockSearchLogs.mockResolvedValueOnce({ data: [], meta: {} });
    const since = '2026-03-14T10:00:00Z';
    await queryLogs({ workerId: 'w1', since });

    const request = mockSearchLogs.mock.calls[0][0];
    expect(request.filter.from).toBe(since);
  });
});

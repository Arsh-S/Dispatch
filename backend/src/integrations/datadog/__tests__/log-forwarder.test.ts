import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../client.js', () => ({
  isEnabled: vi.fn(() => true),
  getConfig: vi.fn(() => ({
    apiKey: 'test-key',
    site: 'datadoghq.com',
    env: 'test',
    service: 'dispatch-scanner',
  })),
  sendLogs: vi.fn(),
}));

import { enqueue, flush, shutdown, getBufferLength, startAutoFlush } from '../log-forwarder.js';
import { sendLogs, isEnabled } from '../client.js';
import { DispatchLogEntry } from '../../../middleware/types.js';

const mockIsEnabled = vi.mocked(isEnabled);
const mockSendLogs = vi.mocked(sendLogs);

function makeEntry(overrides: Partial<DispatchLogEntry> = {}): DispatchLogEntry {
  return {
    timestamp: '2026-03-14T00:00:00.000Z',
    level: 'INFO',
    source: 'console',
    message: 'test message',
    ...overrides,
  };
}

describe('log-forwarder', () => {
  beforeEach(() => {
    mockSendLogs.mockReset();
    mockIsEnabled.mockReturnValue(true);
    flush();
  });

  afterEach(() => {
    shutdown();
  });

  it('enqueues entries and flushes them', () => {
    enqueue(makeEntry(), 'run-1', 'worker-1');
    enqueue(makeEntry({ level: 'ERROR' }), 'run-1', 'worker-1');
    expect(getBufferLength()).toBe(2);

    flush();
    expect(mockSendLogs).toHaveBeenCalledOnce();

    const batch = mockSendLogs.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    expect(batch[0].ddtags).toContain('dispatch_run_id:run-1');
    expect(batch[0].ddtags).toContain('dispatch_worker_id:worker-1');
    expect(batch[0].service).toBe('dispatch-scanner');
    expect(batch[1].status).toBe('error');
  });

  it('is a no-op when disabled', () => {
    mockIsEnabled.mockReturnValue(false);
    enqueue(makeEntry(), 'run-1', 'worker-1');
    expect(getBufferLength()).toBe(0);
    expect(mockSendLogs).not.toHaveBeenCalled();
  });

  it('auto-flushes at batch size 100', () => {
    for (let i = 0; i < 100; i++) {
      enqueue(makeEntry({ message: `msg-${i}` }), 'run-1', 'worker-1');
    }
    expect(mockSendLogs).toHaveBeenCalledOnce();
    expect(mockSendLogs.mock.calls[0][0]).toHaveLength(100);
    expect(getBufferLength()).toBe(0);
  });

  it('flush is a no-op on empty buffer', () => {
    flush();
    expect(mockSendLogs).not.toHaveBeenCalled();
  });

  it('shutdown flushes remaining entries', () => {
    enqueue(makeEntry(), 'run-1', 'worker-1');
    shutdown();
    expect(mockSendLogs).toHaveBeenCalledOnce();
    expect(getBufferLength()).toBe(0);
  });

  it('includes stack traces in message', () => {
    enqueue(makeEntry({ message: 'err', stack: 'Error: err\n  at foo.ts:1' }), 'run-1', 'worker-1');
    flush();
    const payload = mockSendLogs.mock.calls[0][0][0];
    expect(payload.message).toContain('Error: err\n  at foo.ts:1');
  });
});

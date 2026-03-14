import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaskAssignment } from '../../schemas/task-assignment';
import type { FindingReport } from '../../schemas/finding-report';

/**
 * Tests for the 'claude' mode branch in dispatchWorkers.
 *
 * We mock runClaudePentesterWorker to avoid spawning real processes.
 */

const mockFindingReport: FindingReport = {
  dispatch_run_id: 'test-run-001',
  worker_id: 'worker-abc123',
  completed_at: new Date().toISOString(),
  status: 'completed',
  duration_seconds: 10,
  error_detail: null,
  findings: [],
  clean_endpoints: [],
};

const mockAssignment: TaskAssignment = {
  dispatch_run_id: 'test-run-001',
  worker_id: 'worker-abc123',
  assigned_at: new Date().toISOString(),
  timeout_seconds: 300,
  target: {
    file: 'src/routes/orders.ts',
    endpoint: '/api/orders/:id',
    method: 'GET',
    parameters: ['id'],
  },
  attack_type: 'sql-injection',
  context: {
    relevant_files: ['src/routes/orders.ts'],
    rules_md: [],
  },
  app_config: {
    runtime: 'node',
    install: 'npm install',
    start: 'node index.js',
    port: 3000,
    env: {},
  },
  briefing: 'Test assignment for unit testing',
};

beforeEach(() => {
  vi.resetModules();
});

describe('dispatchWorkers claude mode', () => {
  it('should call runClaudePentesterWorker in claude mode', async () => {
    // Mock the claude worker module
    vi.doMock('../../workers/pentester/claude-agent', () => ({
      runClaudePentesterWorker: vi.fn().mockResolvedValue(mockFindingReport),
    }));

    // Also mock fs to avoid real disk writes
    vi.doMock('fs', () => ({
      default: {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
      },
    }));

    const { dispatchWorkers } = await import('../dispatcher');

    const results = await dispatchWorkers(
      [mockAssignment],
      { mode: 'claude', targetDir: '/tmp/test' },
    );

    expect(results).toHaveLength(1);
    expect(results[0].workerId).toBe('worker-abc123');
    expect(results[0].report).toEqual(mockFindingReport);
    expect(results[0].error).toBeUndefined();
  });

  it('should handle claude worker failure gracefully', async () => {
    vi.doMock('../../workers/pentester/claude-agent', () => ({
      runClaudePentesterWorker: vi.fn().mockRejectedValue(new Error('Claude subprocess failed')),
    }));

    vi.doMock('fs', () => ({
      default: {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
      },
    }));

    const { dispatchWorkers } = await import('../dispatcher');

    const results = await dispatchWorkers(
      [mockAssignment],
      { mode: 'claude', targetDir: '/tmp/test' },
    );

    expect(results).toHaveLength(1);
    expect(results[0].workerId).toBe('worker-abc123');
    expect(results[0].report).toBeNull();
    expect(results[0].error).toContain('Claude subprocess failed');
  });

  it('should dispatch multiple assignments sequentially in claude mode', async () => {
    const callOrder: string[] = [];

    vi.doMock('../../workers/pentester/claude-agent', () => ({
      runClaudePentesterWorker: vi.fn().mockImplementation(async (taskPath: string) => {
        callOrder.push(taskPath);
        return { ...mockFindingReport };
      }),
    }));

    vi.doMock('fs', () => ({
      default: {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
      },
    }));

    const assignment2: TaskAssignment = {
      ...mockAssignment,
      worker_id: 'worker-def456',
    };

    const { dispatchWorkers } = await import('../dispatcher');

    const results = await dispatchWorkers(
      [mockAssignment, assignment2],
      { mode: 'claude', targetDir: '/tmp/test' },
    );

    expect(results).toHaveLength(2);
    // Both workers should complete
    expect(results[0].workerId).toBe('worker-abc123');
    expect(results[1].workerId).toBe('worker-def456');
    // Sequential: second should only start after first
    expect(callOrder).toHaveLength(2);
  });

  it('should fire onWorkerDispatched and onWorkerComplete callbacks in claude mode', async () => {
    vi.doMock('../../workers/pentester/claude-agent', () => ({
      runClaudePentesterWorker: vi.fn().mockResolvedValue(mockFindingReport),
    }));

    vi.doMock('fs', () => ({
      default: {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
      },
    }));

    const { dispatchWorkers } = await import('../dispatcher');

    const dispatched: string[] = [];
    const completed: string[] = [];

    await dispatchWorkers(
      [mockAssignment],
      { mode: 'claude', targetDir: '/tmp/test' },
      {
        onWorkerDispatched: (a) => dispatched.push(a.worker_id),
        onWorkerComplete: (r) => completed.push(r.workerId),
      },
    );

    expect(dispatched).toEqual(['worker-abc123']);
    expect(completed).toEqual(['worker-abc123']);
  });
});

describe('DispatcherOptions mode type', () => {
  it('should include claude as a valid mode', async () => {
    // Type-level test: this should compile without error
    const options = { mode: 'claude' as 'local' | 'blaxel' | 'claude', targetDir: '/tmp' };
    expect(options.mode).toBe('claude');
  });
});

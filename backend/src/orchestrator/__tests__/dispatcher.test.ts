import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dispatchWorkers, DispatcherOptions } from '../dispatcher';
import { TaskAssignment } from '../../schemas/task-assignment';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the pentester worker to avoid actually starting apps in tests
vi.mock('../../workers/pentester/agent', () => ({
  runPentesterWorker: vi.fn(async (_taskPath: string, _targetDir: string) => {
    return {
      dispatch_run_id: 'test-run-001',
      worker_id: 'mocked-worker',
      completed_at: new Date().toISOString(),
      status: 'completed' as const,
      duration_seconds: 1,
      error_detail: null,
      findings: [],
      clean_endpoints: [],
    };
  }),
}));

function makeAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    dispatch_run_id: 'test-run-001',
    worker_id: 'worker-sql-injection-users-abc',
    assigned_at: '2026-03-14T10:00:00.000Z',
    timeout_seconds: 300,
    target: {
      file: 'src/routes/users.ts',
      endpoint: '/api/users',
      method: 'GET',
      parameters: ['id'],
    },
    attack_type: 'sql-injection',
    context: {
      relevant_files: ['src/db.ts'],
      rules_md: [],
    },
    app_config: {
      runtime: 'node',
      install: 'echo install',
      start: 'echo started',
      port: 39999,
      env: {},
    },
    briefing: 'Test briefing',
    ...overrides,
  };
}

describe('dispatchWorkers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should dispatch local workers and return results', async () => {
    const assignments = [makeAssignment()];
    const options: DispatcherOptions = { mode: 'local', targetDir: tmpDir };

    const results = await dispatchWorkers(assignments, options);
    expect(results.length).toBe(1);
    expect(results[0].workerId).toBe('worker-sql-injection-users-abc');
    expect(results[0].report).not.toBeNull();
    expect(results[0].report!.status).toBe('completed');
  });

  it('should write task assignment JSON to .dispatch directory', async () => {
    const assignment = makeAssignment();
    const options: DispatcherOptions = { mode: 'local', targetDir: tmpDir };

    await dispatchWorkers([assignment], options);

    const taskFile = path.join(tmpDir, '.dispatch', assignment.worker_id, 'task-assignment.json');
    expect(fs.existsSync(taskFile)).toBe(true);

    const written = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
    expect(written.worker_id).toBe(assignment.worker_id);
    expect(written.attack_type).toBe('sql-injection');
  });

  it('should process multiple workers sequentially', async () => {
    const assignments = [
      makeAssignment({ worker_id: 'w-1' }),
      makeAssignment({ worker_id: 'w-2' }),
      makeAssignment({ worker_id: 'w-3' }),
    ];
    const options: DispatcherOptions = { mode: 'local', targetDir: tmpDir, maxConcurrent: 2 };

    const results = await dispatchWorkers(assignments, options);
    expect(results.length).toBe(3);
    expect(results.map(r => r.workerId)).toEqual(['w-1', 'w-2', 'w-3']);
  });

  it('should return empty results for blaxel mode with no assignments', async () => {
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };
    const results = await dispatchWorkers([], options);
    expect(results).toEqual([]);
  });
});

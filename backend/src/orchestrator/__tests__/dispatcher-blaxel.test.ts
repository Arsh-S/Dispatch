import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Mock @blaxel/core BEFORE importing dispatcher so the module picks up the mock
// at load time.  We use a factory so each test can reconfigure the mock via
// the module-level `mockSandbox` handle.
// ---------------------------------------------------------------------------

// Shared mutable stub — individual tests can override methods as needed.
const mockSandbox = {
  fs: {
    write: vi.fn(async () => {}),
    read: vi.fn(async (_p: string) => JSON.stringify({
      dispatch_run_id: 'test-run-blaxel',
      worker_id: 'blaxel-worker-001',
      completed_at: new Date().toISOString(),
      status: 'completed',
      duration_seconds: 5,
      error_detail: null,
      findings: [],
      clean_endpoints: [],
    })),
  },
  process: {
    exec: vi.fn(async () => ({ logs: '[Blaxel] worker done' })),
  },
  delete: vi.fn(async () => {}),
};

vi.mock('@blaxel/core', () => ({
  SandboxInstance: {
    createIfNotExists: vi.fn(async (_opts: unknown) => mockSandbox),
  },
}));

// Also mock the pentester agent so local-mode tests remain fast
vi.mock('../../workers/pentester/agent', () => ({
  runPentesterWorker: vi.fn(async (_taskPath: string, _targetDir: string) => ({
    dispatch_run_id: 'test-run-local',
    worker_id: 'local-worker',
    completed_at: new Date().toISOString(),
    status: 'completed' as const,
    duration_seconds: 1,
    error_detail: null,
    findings: [],
    clean_endpoints: [],
  })),
}));

// Import AFTER mocks are registered
import { dispatchWorkers, DispatcherOptions } from '../dispatcher';
import { TaskAssignment } from '../../schemas/task-assignment';
import { SandboxInstance } from '@blaxel/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    dispatch_run_id: 'test-run-blaxel',
    worker_id: 'worker-sqli-users-abc',
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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('dispatchWorkers — blaxel mode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-blaxel-test-'));
    // Reset all mock call counts between tests
    vi.clearAllMocks();
    // Re-apply the default read implementation after clearAllMocks
    mockSandbox.fs.read.mockResolvedValue(JSON.stringify({
      dispatch_run_id: 'test-run-blaxel',
      worker_id: 'blaxel-worker-001',
      completed_at: new Date().toISOString(),
      status: 'completed',
      duration_seconds: 5,
      error_detail: null,
      findings: [],
      clean_endpoints: [],
    }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Local mode regression — blaxel changes must not break the existing path
  // -------------------------------------------------------------------------

  it('dispatchWorkers_LocalMode_ReturnsResultsWithoutCallingSandbox', async () => {
    // Arrange
    const assignment = makeAssignment({ worker_id: 'local-w-1' });
    const options: DispatcherOptions = { mode: 'local', targetDir: tmpDir };

    // Act
    const results = await dispatchWorkers([assignment], options);

    // Assert — local mode must bypass SandboxInstance entirely
    expect(SandboxInstance.createIfNotExists).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].workerId).toBe('local-w-1');
    expect(results[0].report).not.toBeNull();
    expect(results[0].error).toBeUndefined();
  });

  it('dispatchWorkers_LocalMode_ReturnsReportWithCompletedStatus', async () => {
    // Arrange
    const options: DispatcherOptions = { mode: 'local', targetDir: tmpDir };

    // Act
    const results = await dispatchWorkers([makeAssignment()], options);

    // Assert
    expect(results[0].report!.status).toBe('completed');
  });

  // -------------------------------------------------------------------------
  // Blaxel mode — SandboxInstance.createIfNotExists is called
  // -------------------------------------------------------------------------

  it('dispatchWorkers_BlaxelMode_CallsCreateIfNotExistsForEachAssignment', async () => {
    // Arrange
    const assignments = [
      makeAssignment({ worker_id: 'blaxel-w-1' }),
      makeAssignment({ worker_id: 'blaxel-w-2' }),
    ];
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers(assignments, options);

    // Assert — one sandbox per worker
    expect(SandboxInstance.createIfNotExists).toHaveBeenCalledTimes(2);
  });

  it('dispatchWorkers_BlaxelMode_PassesSandboxNameDerivedFromWorkerId', async () => {
    // Arrange — sandbox name is built as "dispatch-<worker_id>" (max 63 chars)
    const assignment = makeAssignment({ worker_id: 'worker-sqli-users-abc' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert
    const call = (SandboxInstance.createIfNotExists as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.name).toBe('dispatch-worker-sqli-users-abc');
  });

  it('dispatchWorkers_BlaxelMode_PassesAppPortInSandboxConfig', async () => {
    // Arrange — the port from app_config must be forwarded to the sandbox
    const assignment = makeAssignment({ app_config: { runtime: 'node', install: 'npm i', start: 'npm start', port: 4000, env: {} } });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert
    const call = (SandboxInstance.createIfNotExists as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.ports).toEqual([{ target: 4000, protocol: 'HTTP' }]);
  });

  it('dispatchWorkers_BlaxelMode_WritesTaskAssignmentToSandboxFs', async () => {
    // Arrange
    const assignment = makeAssignment({ worker_id: 'blaxel-w-fs' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert — task assignment must be written to the sandbox filesystem
    const writeCall = mockSandbox.fs.write.mock.calls.find(
      ([p]) => p === '/dispatch/task-assignment.json'
    );
    expect(writeCall).toBeDefined();
    const writtenPayload = JSON.parse(writeCall![1]);
    expect(writtenPayload.worker_id).toBe('blaxel-w-fs');
    expect(writtenPayload.attack_type).toBe('sql-injection');
  });

  it('dispatchWorkers_BlaxelMode_ExecutesInstallCommandInSandbox', async () => {
    // Arrange
    const assignment = makeAssignment({ app_config: { runtime: 'node', install: 'pnpm install', start: 'pnpm start', port: 3000, env: {} } });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert — install command is run before the worker
    const installCall = mockSandbox.process.exec.mock.calls.find(
      ([opts]: [{ command: string }]) => opts.command === 'pnpm install'
    );
    expect(installCall).toBeDefined();
  });

  it('dispatchWorkers_BlaxelMode_ExecutesPentesterWorkerCli', async () => {
    // Arrange
    const assignment = makeAssignment({ worker_id: 'blaxel-w-exec' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert — the pentester CLI must be invoked inside the sandbox
    const pentesterCall = mockSandbox.process.exec.mock.calls.find(
      ([opts]: [{ command: string }]) => opts.command.includes('cli.ts')
    );
    expect(pentesterCall).toBeDefined();
    expect(pentesterCall![0].command).toContain('/dispatch/task-assignment.json');
    expect(pentesterCall![0].command).toContain('/app');
  });

  it('dispatchWorkers_BlaxelMode_ReturnsParsedFindingReport', async () => {
    // Arrange
    const assignment = makeAssignment({ worker_id: 'blaxel-w-report' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    const results = await dispatchWorkers([assignment], options);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].workerId).toBe('blaxel-w-report');
    expect(results[0].report).not.toBeNull();
    expect(results[0].report!.status).toBe('completed');
    expect(results[0].error).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Blaxel mode — seed command is optional
  // -------------------------------------------------------------------------

  it('dispatchWorkers_BlaxelMode_WithSeedCommand_ExecutesSeedBeforeWorker', async () => {
    // Arrange — app_config.seed is present
    const assignment = makeAssignment({
      app_config: { runtime: 'node', install: 'npm i', start: 'npm start', port: 3000, seed: 'npm run seed', env: {} },
    });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert — seed command was executed
    const seedCall = mockSandbox.process.exec.mock.calls.find(
      ([opts]: [{ command: string }]) => opts.command === 'npm run seed'
    );
    expect(seedCall).toBeDefined();
  });

  it('dispatchWorkers_BlaxelMode_WithoutSeedCommand_DoesNotCallSeedExec', async () => {
    // Arrange — no seed field in app_config
    const assignment = makeAssignment({
      app_config: { runtime: 'node', install: 'npm i', start: 'npm start', port: 3000, env: {} },
    });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert — process.exec was called (install + pentester), but NOT for any seed
    // The install command and the pentester CLI command account for all exec calls
    const allCommands = mockSandbox.process.exec.mock.calls.map(([opts]: [{ command: string }]) => opts.command);
    expect(allCommands.some(cmd => cmd.includes('seed'))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Blaxel mode — sandbox cleanup (delete) in the finally block
  // -------------------------------------------------------------------------

  it('dispatchWorkers_BlaxelMode_OnSuccess_DeletesSandboxAfterWorkerCompletes', async () => {
    // Arrange
    const assignment = makeAssignment({ worker_id: 'blaxel-w-cleanup' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert — sandbox.delete() must be called exactly once (in the finally block)
    expect(mockSandbox.delete).toHaveBeenCalledTimes(1);
  });

  it('dispatchWorkers_BlaxelMode_OnWorkerFailure_StillDeletesSandbox', async () => {
    // Arrange — pentester CLI process.exec rejects to simulate worker failure
    mockSandbox.process.exec.mockImplementationOnce(async () => ({ logs: 'install ok' })); // install succeeds
    mockSandbox.process.exec.mockRejectedValueOnce(new Error('pentester process exited with code 1'));
    const assignment = makeAssignment({ worker_id: 'blaxel-w-fail-cleanup' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    const results = await dispatchWorkers([assignment], options);

    // Assert — sandbox must be deleted even when the worker crashes
    expect(mockSandbox.delete).toHaveBeenCalledTimes(1);
    // And the error must be surfaced in the result, not re-thrown
    expect(results[0].report).toBeNull();
    expect(results[0].error).toContain('pentester process exited with code 1');
  });

  // -------------------------------------------------------------------------
  // Blaxel mode — worker errors are caught and returned as { report: null, error }
  // -------------------------------------------------------------------------

  it('dispatchWorkers_BlaxelMode_WhenCreateIfNotExistsFails_ReturnsErrorResult', async () => {
    // Arrange — sandbox creation itself fails
    (SandboxInstance.createIfNotExists as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Blaxel quota exceeded')
    );
    const assignment = makeAssignment({ worker_id: 'blaxel-w-quota' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    const results = await dispatchWorkers([assignment], options);

    // Assert — error is surfaced gracefully without throwing
    expect(results).toHaveLength(1);
    expect(results[0].report).toBeNull();
    expect(results[0].error).toBe('Blaxel quota exceeded');
  });

  it('dispatchWorkers_BlaxelMode_WhenReportReadFails_FallsBackToAlternatePathThenReturnsError', async () => {
    // Arrange — both sandbox.fs.read calls reject (primary and fallback paths)
    mockSandbox.fs.read.mockRejectedValue(new Error('File not found in sandbox'));
    const assignment = makeAssignment({ worker_id: 'blaxel-w-nofile' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    const results = await dispatchWorkers([assignment], options);

    // Assert — no crash, error is captured in the result
    expect(results[0].report).toBeNull();
    expect(results[0].error).toContain('File not found in sandbox');
    // And sandbox cleanup still ran
    expect(mockSandbox.delete).toHaveBeenCalledTimes(1);
  });

  it('dispatchWorkers_BlaxelMode_WhenWorkerFails_DoesNotThrow', async () => {
    // Arrange — simulate a generic worker failure
    (SandboxInstance.createIfNotExists as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network timeout')
    );
    const assignment = makeAssignment({ worker_id: 'blaxel-w-timeout' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act + Assert — must never propagate the error to the caller
    await expect(dispatchWorkers([assignment], options)).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Blaxel mode — concurrency: maxConcurrent batching
  // -------------------------------------------------------------------------

  it('dispatchWorkers_BlaxelMode_WithMultipleAssignments_ProcessesAllWorkers', async () => {
    // Arrange
    const assignments = [
      makeAssignment({ worker_id: 'blaxel-batch-1' }),
      makeAssignment({ worker_id: 'blaxel-batch-2' }),
      makeAssignment({ worker_id: 'blaxel-batch-3' }),
    ];
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir, maxConcurrent: 2 };

    // Act
    const results = await dispatchWorkers(assignments, options);

    // Assert — all three workers produce results
    expect(results).toHaveLength(3);
    expect(SandboxInstance.createIfNotExists).toHaveBeenCalledTimes(3);
  });

  it('dispatchWorkers_BlaxelMode_WithMaxConcurrentOne_ProcessesWorkersOneAtATime', async () => {
    // Arrange — with maxConcurrent: 1, batches of 1 are processed sequentially
    const assignments = [
      makeAssignment({ worker_id: 'serial-1' }),
      makeAssignment({ worker_id: 'serial-2' }),
    ];
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir, maxConcurrent: 1 };

    // Act
    const results = await dispatchWorkers(assignments, options);

    // Assert
    expect(results).toHaveLength(2);
    expect(SandboxInstance.createIfNotExists).toHaveBeenCalledTimes(2);
  });

  it('dispatchWorkers_BlaxelMode_WithEmptyAssignments_ReturnsEmptyArray', async () => {
    // Arrange
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    const results = await dispatchWorkers([], options);

    // Assert
    expect(results).toHaveLength(0);
    expect(SandboxInstance.createIfNotExists).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Sandbox name sanitization — worker IDs with special characters
  // -------------------------------------------------------------------------

  it('dispatchWorkers_BlaxelMode_SanitizesSandboxNameToLowercaseAlphanumericAndDashes', async () => {
    // Arrange — worker_id with underscores and uppercase (which are invalid in sandbox names)
    const assignment = makeAssignment({ worker_id: 'WORKER_SQL_USERS_123' });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert — name must be lowercased and underscores replaced with dashes
    const call = (SandboxInstance.createIfNotExists as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The source builds: `dispatch-${worker_id}`.replace(/[^a-z0-9-]/g, '-')
    expect(call.name).toMatch(/^[a-z0-9-]+$/);
    expect(call.name.length).toBeLessThanOrEqual(63);
  });

  it('dispatchWorkers_BlaxelMode_TruncatesSandboxNameToMaxOf63Characters', async () => {
    // Arrange — extremely long worker ID (must be capped at 63 chars)
    const longId = 'a'.repeat(70);
    const assignment = makeAssignment({ worker_id: longId });
    const options: DispatcherOptions = { mode: 'blaxel', targetDir: tmpDir };

    // Act
    await dispatchWorkers([assignment], options);

    // Assert
    const call = (SandboxInstance.createIfNotExists as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.name.length).toBeLessThanOrEqual(63);
  });
});

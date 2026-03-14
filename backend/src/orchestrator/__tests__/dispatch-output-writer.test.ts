import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DispatchOutputWriter } from '../dispatch-output-writer';
import type { DispatchOutput } from '../graph-types';
import type { PreReconDeliverable } from '../../schemas/pre-recon-deliverable';
import type { TaskAssignment } from '../../schemas/task-assignment';
import type { Finding, FindingReport } from '../../schemas/finding-report';
import type { WorkerResult } from '../dispatcher';
import type { MergedReport } from '../collector';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePreRecon(overrides: Partial<PreReconDeliverable> = {}): PreReconDeliverable {
  return {
    dispatch_run_id: 'run-1',
    completed_at: '2026-03-14T10:00:00.000Z',
    route_map: [
      {
        endpoint: 'GET /api/users',
        method: 'GET',
        handler_file: 'src/routes/users.ts',
        handler_line: 10,
        middleware: [],
        parameters: [{ name: 'id', source: 'params', type: 'string' }],
      },
      {
        endpoint: 'POST /api/login',
        method: 'POST',
        handler_file: 'src/routes/auth.ts',
        handler_line: 5,
        middleware: [],
        parameters: [
          { name: 'username', source: 'body', type: 'string' },
          { name: 'password', source: 'body', type: 'string' },
        ],
      },
    ],
    risk_signals: [],
    dependency_graph: {},
    briefing_notes: 'Test briefing.',
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    dispatch_run_id: 'run-1',
    worker_id: 'w-sqli-001',
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
      install: 'pnpm install',
      start: 'pnpm start',
      port: 3000,
      env: {},
    },
    briefing: 'Test SQL injection on /api/users',
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    finding_id: 'f-001',
    severity: 'HIGH',
    vuln_type: 'sql-injection',
    exploit_confidence: 'confirmed',
    location: {
      file: 'src/routes/users.ts',
      line: 42,
      endpoint: '/api/users',
      method: 'GET',
      parameter: 'id',
    },
    description: 'SQL injection via user ID parameter',
    monkeypatch: { status: 'not-attempted' },
    recommended_fix: 'Use parameterized queries',
    server_logs: [],
    rules_violated: [],
    ...overrides,
  };
}

function makeFindingReport(overrides: Partial<FindingReport> = {}): FindingReport {
  return {
    dispatch_run_id: 'run-1',
    worker_id: 'w-sqli-001',
    completed_at: '2026-03-14T10:05:00.000Z',
    status: 'completed',
    duration_seconds: 60,
    error_detail: null,
    findings: [],
    clean_endpoints: [],
    ...overrides,
  };
}

function makeWorkerResult(overrides: Partial<WorkerResult> = {}): WorkerResult {
  return {
    workerId: 'w-sqli-001',
    report: makeFindingReport(),
    ...overrides,
  };
}

function makeMergedReport(overrides: Partial<MergedReport> = {}): MergedReport {
  return {
    dispatch_run_id: 'run-1',
    completed_at: '2026-03-14T10:10:00.000Z',
    duration_seconds: 120,
    total_workers: 1,
    findings: [],
    clean_endpoints: [],
    worker_errors: [],
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total_endpoints: 0,
      vulnerable_endpoints: 0,
      clean_endpoints: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DispatchOutputWriter', () => {
  let tmpDir: string;
  let outputPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-writer-'));
    outputPath = path.join(tmpDir, 'dispatch-output.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readOutput(): DispatchOutput {
    return JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  }

  it('constructor_CreatesInitialOutputFileWithIdleStatus', () => {
    new DispatchOutputWriter(outputPath, 'run-1');

    expect(fs.existsSync(outputPath)).toBe(true);
    const output = readOutput();
    expect(output.dispatch_run_id).toBe('run-1');
    expect(output.status).toBe('idle');
    expect(output.task_assignments).toEqual([]);
    expect(output.finding_reports).toEqual([]);
    expect(output.findings).toEqual([]);
    expect(output.metrics.routesDiscovered).toBe(0);
    expect(output.metrics.workersActive).toBe(0);
    expect(output.metrics.findingsFound).toBe(0);
  });

  it('writePhase_UpdatesStatusAndRewritesFile', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');

    writer.writePhase('executing');

    const output = readOutput();
    expect(output.status).toBe('executing');
  });

  it('onPreReconComplete_SetsPlanningStatusAndPopulatesPreRecon', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');
    const preRecon = makePreRecon();

    writer.onPreReconComplete(preRecon);

    const output = readOutput();
    expect(output.status).toBe('planning');
    expect(output.pre_recon).toBeDefined();
    expect(output.pre_recon?.route_map).toHaveLength(2);
    expect(output.metrics.routesDiscovered).toBe(2);
  });

  it('onAttackMatrixComplete_PopulatesAssignmentsAndGraphDataWithQueuedWorkers', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');
    const assignments = [
      makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' }),
      makeAssignment({
        worker_id: 'w-2',
        attack_type: 'xss',
        target: { file: 'src/routes/search.ts', endpoint: '/api/search', method: 'GET', parameters: ['q'] },
      }),
    ];

    writer.onAttackMatrixComplete(assignments);

    const output = readOutput();
    expect(output.task_assignments).toHaveLength(2);
    expect(output.graph_data).toBeDefined();
    expect(output.graph_data!.clusters['sql-injection']).toBeDefined();
    expect(output.graph_data!.clusters['xss']).toBeDefined();
    expect(output.graph_data!.nodes['w-1']?.status).toBe('queued');
    expect(output.graph_data!.nodes['w-2']?.status).toBe('queued');
  });

  it('onWorkerDispatched_SetsWorkerNodeStatusToRunning', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');
    const assignment = makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' });
    writer.onAttackMatrixComplete([assignment]);

    writer.onWorkerDispatched(assignment);

    const output = readOutput();
    expect(output.graph_data?.nodes['w-1']?.status).toBe('running');
  });

  it('onWorkerComplete_UpdatesWorkerStatusAndAddsFindings', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');
    const assignment = makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' });
    writer.onAttackMatrixComplete([assignment]);
    writer.onWorkerDispatched(assignment);

    const finding = makeFinding({ finding_id: 'f-1' });
    const result = makeWorkerResult({
      workerId: 'w-1',
      report: makeFindingReport({ worker_id: 'w-1', findings: [finding] }),
    });
    writer.onWorkerComplete(result);

    const output = readOutput();
    expect(output.graph_data?.nodes['w-1']?.status).toBe('success');
    expect(output.finding_reports).toHaveLength(1);
    expect(output.findings).toHaveLength(1);
    expect(output.findings[0].finding_id).toBe('f-1');
  });

  it('onComplete_SetsCompletedStatusWithFindingsAndMetrics', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');
    const preRecon = makePreRecon();
    writer.onPreReconComplete(preRecon);

    const assignments = [makeAssignment({ worker_id: 'w-1' })];
    writer.onAttackMatrixComplete(assignments);
    writer.onWorkerDispatched(assignments[0]);

    const finding = makeFinding({ finding_id: 'f-1' });
    const workerResults = [
      makeWorkerResult({
        workerId: 'w-1',
        report: makeFindingReport({ worker_id: 'w-1', findings: [finding] }),
      }),
    ];
    const merged = makeMergedReport({ findings: [finding] });

    writer.onComplete(merged, workerResults);

    const output = readOutput();
    expect(output.status).toBe('completed');
    expect(output.completed_at).toBeDefined();
    expect(output.findings).toHaveLength(1);
    expect(output.findings[0].finding_id).toBe('f-1');
    expect(output.graph_data?.nodes['w-1']?.status).toBe('success');
  });

  it('allLifecycleMethods_WriteValidJsonAtEachStep', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');
    expect(() => JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).not.toThrow();

    writer.onPreReconComplete(makePreRecon());
    expect(() => JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).not.toThrow();

    const assignment = makeAssignment({ worker_id: 'w-1' });
    writer.onAttackMatrixComplete([assignment]);
    expect(() => JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).not.toThrow();

    writer.onWorkerDispatched(assignment);
    expect(() => JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).not.toThrow();

    const result = makeWorkerResult({ workerId: 'w-1' });
    writer.onWorkerComplete(result);
    expect(() => JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).not.toThrow();

    writer.onComplete(makeMergedReport(), [result]);
    expect(() => JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).not.toThrow();
  });

  it('onComplete_CalculatesCorrectMetrics', () => {
    const writer = new DispatchOutputWriter(outputPath, 'run-1');
    const preRecon = makePreRecon(); // 2 routes in route_map
    writer.onPreReconComplete(preRecon);

    const assignments = [
      makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' }),
      makeAssignment({
        worker_id: 'w-2',
        attack_type: 'xss',
        target: { file: 'src/routes/auth.ts', endpoint: '/api/login', method: 'POST', parameters: ['username'] },
      }),
    ];
    writer.onAttackMatrixComplete(assignments);
    writer.onWorkerDispatched(assignments[0]);
    writer.onWorkerDispatched(assignments[1]);

    const finding = makeFinding({ finding_id: 'f-1' });
    const workerResults = [
      makeWorkerResult({
        workerId: 'w-1',
        report: makeFindingReport({ worker_id: 'w-1', findings: [finding] }),
      }),
      makeWorkerResult({
        workerId: 'w-2',
        report: makeFindingReport({ worker_id: 'w-2' }),
      }),
    ];
    writer.onWorkerComplete(workerResults[0]);
    writer.onWorkerComplete(workerResults[1]);

    const merged = makeMergedReport({ findings: [finding] });
    writer.onComplete(merged, workerResults);

    const output = writer.getCurrentOutput();
    expect(output.metrics.routesDiscovered).toBe(2);
    expect(output.metrics.workersActive).toBe(0);
    expect(output.metrics.findingsFound).toBe(1);
  });
});

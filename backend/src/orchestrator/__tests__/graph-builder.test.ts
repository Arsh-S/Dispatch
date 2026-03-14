import { describe, it, expect } from 'vitest';
import { buildGraphData } from '../graph-builder';
import type { TaskAssignment } from '../../schemas/task-assignment';
import type { Finding, FindingReport } from '../../schemas/finding-report';
import type { WorkerResult } from '../dispatcher';
import type { MergedReport } from '../collector';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

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

describe('buildGraphData', () => {
  it('Always_CreatesOrchestratorNode', () => {
    const result = buildGraphData('run-1', null, [], [], null);

    expect(result.nodes['orchestrator']).toBeDefined();
    expect(result.nodes['orchestrator'].type).toBe('orchestrator');
    expect(result.nodes['orchestrator'].status).toBe('running');
    expect(result.nodes['orchestrator'].label).toBe('Orchestrator');
  });

  it('WithAssignments_CreatesClusterPerAttackType', () => {
    const assignments = [
      makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' }),
      makeAssignment({ worker_id: 'w-2', attack_type: 'xss' }),
    ];

    const result = buildGraphData('run-1', null, assignments, [], null);

    expect(result.clusters['sql-injection']).toBeDefined();
    expect(result.clusters['sql-injection'].type).toBe('cluster');
    expect(result.clusters['xss']).toBeDefined();
    expect(result.clusters['xss'].type).toBe('cluster');
    // Cluster also appears in nodes record
    expect(result.nodes['sql-injection']).toBeDefined();
    expect(result.nodes['sql-injection'].type).toBe('cluster');
  });

  it('WithAssignments_CreatesWorkerNodePerAssignment', () => {
    const assignments = [
      makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' }),
      makeAssignment({ worker_id: 'w-2', attack_type: 'xss' }),
    ];

    const result = buildGraphData('run-1', null, assignments, [], null);

    expect(result.nodes['w-1']).toBeDefined();
    expect(result.nodes['w-1'].type).toBe('worker');
    expect(result.nodes['w-1'].clusterId).toBe('sql-injection');
    expect(result.nodes['w-2']).toBeDefined();
    expect(result.nodes['w-2'].type).toBe('worker');
    expect(result.nodes['w-2'].clusterId).toBe('xss');
  });

  it('WithNoWorkerResults_SetsWorkersToQueued', () => {
    const assignments = [
      makeAssignment({ worker_id: 'w-1' }),
      makeAssignment({ worker_id: 'w-2', attack_type: 'xss' }),
    ];

    const result = buildGraphData('run-1', null, assignments, [], null);

    expect(result.nodes['w-1'].status).toBe('queued');
    expect(result.nodes['w-2'].status).toBe('queued');
  });

  it('WithCompletedWorkerReport_SetsWorkerToSuccess', () => {
    const assignments = [makeAssignment({ worker_id: 'w-1' })];
    const workerResults = [
      makeWorkerResult({
        workerId: 'w-1',
        report: makeFindingReport({ worker_id: 'w-1' }),
      }),
    ];

    const result = buildGraphData('run-1', null, assignments, workerResults, null);

    expect(result.nodes['w-1'].status).toBe('success');
  });

  it('WithWorkerError_SetsWorkerToFailed', () => {
    const assignments = [makeAssignment({ worker_id: 'w-1' })];
    const workerResults: WorkerResult[] = [
      { workerId: 'w-1', report: null, error: 'Worker timed out after 300s' },
    ];

    const result = buildGraphData('run-1', null, assignments, workerResults, null);

    expect(result.nodes['w-1'].status).toBe('failed');
  });

  it('WithMergedReport_CreatesFindingNodesWithMappedSeverity', () => {
    const findings = [
      makeFinding({ finding_id: 'f-crit', severity: 'CRITICAL' }),
      makeFinding({
        finding_id: 'f-low',
        severity: 'LOW',
        location: { file: 'b.ts', line: 5, endpoint: '/api/b', method: 'POST', parameter: 'q' },
      }),
    ];
    const assignments = [makeAssignment({ worker_id: 'w-1' })];
    const workerResults = [
      makeWorkerResult({
        workerId: 'w-1',
        report: makeFindingReport({ worker_id: 'w-1', findings }),
      }),
    ];
    const merged = makeMergedReport({ findings });

    const result = buildGraphData('run-1', null, assignments, workerResults, merged);

    expect(result.nodes['f-crit']).toBeDefined();
    expect(result.nodes['f-crit'].type).toBe('finding');
    expect(result.nodes['f-crit'].severity).toBe('critical');
    expect(result.nodes['f-low']).toBeDefined();
    expect(result.nodes['f-low'].type).toBe('finding');
    expect(result.nodes['f-low'].severity).toBe('low');
  });

  it('WithFullData_CreatesOrchestratorClusterWorkerFindingEdges', () => {
    const finding = makeFinding({ finding_id: 'f-1' });
    const assignments = [makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' })];
    const workerResults = [
      makeWorkerResult({
        workerId: 'w-1',
        report: makeFindingReport({ worker_id: 'w-1', findings: [finding] }),
      }),
    ];
    const merged = makeMergedReport({ findings: [finding] });

    const result = buildGraphData('run-1', null, assignments, workerResults, merged);

    // orchestrator → cluster
    expect(result.edges).toContainEqual(
      expect.objectContaining({ from: 'orchestrator', to: 'sql-injection', kind: 'orchestrator' }),
    );
    // cluster → worker
    expect(result.edges).toContainEqual(
      expect.objectContaining({ from: 'sql-injection', to: 'w-1', kind: 'worker' }),
    );
    // worker → finding
    expect(result.edges).toContainEqual(
      expect.objectContaining({ from: 'w-1', to: 'f-1', kind: 'finding' }),
    );
  });

  it('WithEmptyAssignments_ReturnsOnlyOrchestratorNode', () => {
    const result = buildGraphData('run-1', null, [], [], null);

    expect(Object.keys(result.nodes)).toHaveLength(1);
    expect(result.nodes['orchestrator']).toBeDefined();
    expect(result.edges).toHaveLength(0);
    expect(Object.keys(result.clusters)).toHaveLength(0);
  });

  it('WithDuplicateAttackTypes_CreatesOneClusterPerType', () => {
    const assignments = [
      makeAssignment({ worker_id: 'w-1', attack_type: 'sql-injection' }),
      makeAssignment({
        worker_id: 'w-2',
        attack_type: 'sql-injection',
        target: { file: 'src/routes/auth.ts', endpoint: '/api/login', method: 'POST', parameters: ['username'] },
      }),
    ];

    const result = buildGraphData('run-1', null, assignments, [], null);

    expect(Object.keys(result.clusters)).toHaveLength(1);
    expect(result.clusters['sql-injection']).toBeDefined();
    // Both workers still exist under the single cluster
    expect(result.nodes['w-1']).toBeDefined();
    expect(result.nodes['w-1'].clusterId).toBe('sql-injection');
    expect(result.nodes['w-2']).toBeDefined();
    expect(result.nodes['w-2'].clusterId).toBe('sql-injection');
  });
});

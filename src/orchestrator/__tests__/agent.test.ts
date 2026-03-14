import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { runOrchestrator } from '../agent';
import { PreReconDeliverableSchema } from '../../schemas/pre-recon-deliverable';

const SAMPLE_APP_DIR = path.resolve(__dirname, '../../../sample-app');

// Mock the dispatcher to avoid actually starting apps in unit tests
vi.mock('../dispatcher', () => ({
  dispatchWorkers: vi.fn(async (assignments: any[]) => {
    return assignments.map((a: any) => ({
      workerId: a.worker_id,
      report: {
        dispatch_run_id: a.dispatch_run_id,
        worker_id: a.worker_id,
        completed_at: new Date().toISOString(),
        status: 'completed' as const,
        duration_seconds: 1,
        error_detail: null,
        findings: [],
        clean_endpoints: [],
      },
    }));
  }),
}));

describe('runOrchestrator', { timeout: 30000 }, () => {
  it('should return a preRecon deliverable that validates against the schema', async () => {
    const result = await runOrchestrator({ targetDir: SAMPLE_APP_DIR, mode: 'local' });

    expect(result.preRecon).toBeDefined();
    const parsed = PreReconDeliverableSchema.safeParse(result.preRecon);
    expect(parsed.success).toBe(true);
  });

  it('should generate a dispatch run id', async () => {
    const result = await runOrchestrator({ targetDir: SAMPLE_APP_DIR });

    expect(result.preRecon.dispatch_run_id).toMatch(/^dispatch-run-/);
  });

  it('should populate route_map and risk_signals', async () => {
    const result = await runOrchestrator({ targetDir: SAMPLE_APP_DIR });

    expect(result.preRecon.route_map.length).toBeGreaterThan(0);
    expect(result.preRecon.risk_signals.length).toBeGreaterThan(0);
  });

  it('should create task assignments from attack matrix', async () => {
    const result = await runOrchestrator({ targetDir: SAMPLE_APP_DIR });

    expect(result.assignments.length).toBeGreaterThan(0);
    // Each assignment should have required fields
    for (const a of result.assignments) {
      expect(a.dispatch_run_id).toMatch(/^dispatch-run-/);
      expect(a.worker_id).toBeTruthy();
      expect(a.attack_type).toBeTruthy();
      expect(a.target.endpoint).toBeTruthy();
    }
  });

  it('should return worker results matching assignment count', async () => {
    const result = await runOrchestrator({ targetDir: SAMPLE_APP_DIR });

    expect(result.workerResults.length).toBe(result.assignments.length);
  });

  it('should produce a merged report when workers return reports', async () => {
    const result = await runOrchestrator({ targetDir: SAMPLE_APP_DIR });

    // With mocked dispatcher returning completed reports, we should get a merged report
    expect(result.mergedReport).not.toBeNull();
    expect(result.mergedReport!.dispatch_run_id).toBeTruthy();
    expect(result.mergedReport!.total_workers).toBe(result.workerResults.length);
  });
});

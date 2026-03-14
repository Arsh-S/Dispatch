import { describe, it, expect } from 'vitest';
import path from 'path';
import { runOrchestrator } from '../agent';
import { PreReconDeliverableSchema } from '../../schemas/pre-recon-deliverable';

const SAMPLE_APP_DIR = path.resolve(__dirname, '../../../sample-app');

describe('runOrchestrator', () => {
  it('should return a preRecon deliverable that validates against the schema', async () => {
    const result = await runOrchestrator({ targetDir: SAMPLE_APP_DIR });

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
});

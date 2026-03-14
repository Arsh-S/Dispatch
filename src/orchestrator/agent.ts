import { runPreRecon } from './pre-recon';
import { PreReconDeliverable } from '../schemas/pre-recon-deliverable';
import { v4 as uuidv4 } from 'uuid';

// Note: Full Mastra agent integration will be added when attack matrix and dispatcher are built.
// For now, this is a functional module that runs the orchestrator pipeline.

interface OrchestratorOptions {
  targetDir: string;
}

export async function runOrchestrator(options: OrchestratorOptions): Promise<{
  preRecon: PreReconDeliverable;
}> {
  const dispatchRunId = `dispatch-run-${uuidv4().slice(0, 5)}`;

  console.log(`[Orchestrator] Starting scan run: ${dispatchRunId}`);
  console.log(`[Orchestrator] Target: ${options.targetDir}`);

  // Phase 0: Pre-Recon
  console.log('[Orchestrator] Running pre-recon...');
  const preRecon = await runPreRecon({
    targetDir: options.targetDir,
    dispatchRunId,
  });

  console.log(`[Orchestrator] Pre-recon complete. Found ${preRecon.route_map.length} routes, ${preRecon.risk_signals.length} risk signals.`);

  return { preRecon };
}

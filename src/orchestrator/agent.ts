import { runPreRecon } from './pre-recon';
import { buildAttackMatrix, createTaskAssignments } from './attack-matrix';
import { dispatchWorkers, WorkerResult } from './dispatcher';
import { mergeReports, MergedReport } from './collector';
import { PreReconDeliverable } from '../schemas/pre-recon-deliverable';
import { TaskAssignment } from '../schemas/task-assignment';
import { FindingReport } from '../schemas/finding-report';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

interface OrchestratorOptions {
  targetDir: string;
  mode?: 'local' | 'blaxel';
  maxWorkers?: number;
  outputPath?: string;
}

export interface OrchestratorResult {
  preRecon: PreReconDeliverable;
  assignments: TaskAssignment[];
  workerResults: WorkerResult[];
  mergedReport: MergedReport | null;
}

export async function runOrchestrator(options: OrchestratorOptions): Promise<OrchestratorResult> {
  const dispatchRunId = `dispatch-run-${uuidv4().slice(0, 5)}`;
  const mode = options.mode || 'local';

  console.log(`[Orchestrator] Starting scan run: ${dispatchRunId}`);
  console.log(`[Orchestrator] Target: ${options.targetDir}`);
  console.log(`[Orchestrator] Mode: ${mode}`);

  // Phase 0: Pre-Recon
  console.log('[Orchestrator] Running pre-recon...');
  const preRecon = await runPreRecon({
    targetDir: options.targetDir,
    dispatchRunId,
  });
  console.log(`[Orchestrator] Pre-recon complete. Found ${preRecon.route_map.length} routes, ${preRecon.risk_signals.length} risk signals.`);

  // Phase 1: Attack Matrix
  console.log('[Orchestrator] Building attack matrix...');
  const matrix = buildAttackMatrix(preRecon);
  console.log(`[Orchestrator] Attack matrix: ${matrix.length} cells (filtered to high-risk).`);

  // Read auth token if available
  const tokenPath = path.join(options.targetDir, 'test-token.txt');
  const authToken = fs.existsSync(tokenPath)
    ? fs.readFileSync(tokenPath, 'utf-8').trim()
    : undefined;

  // Create task assignments
  const assignments = createTaskAssignments(preRecon, matrix, options.targetDir, authToken);
  console.log(`[Orchestrator] Created ${assignments.length} task assignments.`);

  // Phase 2: Dispatch Workers
  console.log('[Orchestrator] Dispatching workers...');
  const workerResults = await dispatchWorkers(assignments, {
    mode,
    targetDir: options.targetDir,
    maxConcurrent: options.maxWorkers || 2,
  });

  // Phase 3: Collect Results
  const completedReports = workerResults
    .filter(r => r.report !== null)
    .map(r => r.report as FindingReport);

  let mergedReport: MergedReport | null = null;
  if (completedReports.length > 0) {
    console.log('[Orchestrator] Merging reports...');
    mergedReport = mergeReports(completedReports);
    console.log(`[Orchestrator] Merged: ${mergedReport.findings.length} findings (${mergedReport.summary.critical} critical, ${mergedReport.summary.high} high).`);

    // Write output
    const outputPath = options.outputPath || path.join(options.targetDir, '..', 'dispatch-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(mergedReport, null, 2));
    console.log(`[Orchestrator] Output written to ${outputPath}`);
  } else {
    console.log('[Orchestrator] No completed reports to merge.');
  }

  return { preRecon, assignments, workerResults, mergedReport };
}

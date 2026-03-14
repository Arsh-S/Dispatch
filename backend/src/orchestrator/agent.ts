import { runPreRecon } from './pre-recon';
import { buildAttackMatrix, createTaskAssignments } from './attack-matrix';
import { dispatchWorkers, WorkerResult } from './dispatcher';
import { mergeReports, MergedReport, forwardToDatadog } from './collector';
import { DispatchOutputWriter } from './dispatch-output-writer';
import type { PreReconDeliverable } from '../schemas/pre-recon-deliverable';
import type { TaskAssignment } from '../schemas/task-assignment';
import type { FindingReport } from '../schemas/finding-report';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
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
  gitSha?: string;
}

export async function runOrchestrator(options: OrchestratorOptions): Promise<OrchestratorResult> {
  const dispatchRunId = `dispatch-run-${uuidv4().slice(0, 5)}`;
  const mode = options.mode || 'local';
  const outputPath = options.outputPath || path.join(options.targetDir, '..', 'dispatch-output.json');

  const writer = new DispatchOutputWriter(outputPath, dispatchRunId, path.basename(options.targetDir));

  console.log(`[Orchestrator] Starting scan run: ${dispatchRunId}`);
  console.log(`[Orchestrator] Target: ${options.targetDir}`);
  console.log(`[Orchestrator] Mode: ${mode}`);

  let gitSha: string | undefined;
  try {
    gitSha = execSync('git rev-parse HEAD', { cwd: options.targetDir })
      .toString().trim();
  } catch {
    /* not a git repo — gitSha stays undefined */
  }

  writer.writePhase('planning');

  // Phase 0: Pre-Recon
  console.log('[Orchestrator] Running pre-recon...');
  const preRecon = await runPreRecon({
    targetDir: options.targetDir,
    dispatchRunId,
  });
  console.log(`[Orchestrator] Pre-recon complete. Found ${preRecon.route_map.length} routes, ${preRecon.risk_signals.length} risk signals.`);

  writer.onPreReconComplete(preRecon);

  // Phase 1: Attack Matrix
  console.log('[Orchestrator] Building attack matrix...');
  const matrix = buildAttackMatrix(preRecon);
  console.log(`[Orchestrator] Attack matrix: ${matrix.length} cells (filtered to high-risk).`);

  const tokenPath = path.join(options.targetDir, 'test-token.txt');
  const authToken = fs.existsSync(tokenPath)
    ? fs.readFileSync(tokenPath, 'utf-8').trim()
    : undefined;

  const assignments = createTaskAssignments(preRecon, matrix, options.targetDir, authToken);
  console.log(`[Orchestrator] Created ${assignments.length} task assignments.`);

  writer.onAttackMatrixComplete(assignments);

  // Phase 2: Dispatch Workers
  console.log('[Orchestrator] Dispatching workers...');
  const workerResults = await dispatchWorkers(
    assignments,
    {
      mode,
      targetDir: options.targetDir,
      maxConcurrent: options.maxWorkers || 2,
    },
    {
      onWorkerDispatched: (a) => writer.onWorkerDispatched(a),
      onWorkerComplete: (r) => writer.onWorkerComplete(r),
    },
  );

  // Phase 3: Collect Results
  const completedReports = workerResults
    .filter(r => r.report !== null)
    .map(r => r.report as FindingReport);

  let mergedReport: MergedReport | null = null;
  if (completedReports.length > 0) {
    console.log('[Orchestrator] Merging reports...');
    mergedReport = mergeReports(completedReports);
    await forwardToDatadog(mergedReport);
    console.log(`[Orchestrator] Merged: ${mergedReport.findings.length} findings (${mergedReport.summary.critical} critical, ${mergedReport.summary.high} high).`);
  } else {
    console.log('[Orchestrator] No completed reports to merge.');
  }

  writer.onComplete(mergedReport, workerResults);
  console.log(`[Orchestrator] Output written to ${outputPath}`);

  return { preRecon, assignments, workerResults, mergedReport, gitSha };
}

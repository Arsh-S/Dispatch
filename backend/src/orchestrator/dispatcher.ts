import { TaskAssignment } from '../schemas/task-assignment';
import { FindingReport, FindingReportSchema } from '../schemas/finding-report';
import { runPentesterWorker } from '../workers/pentester/agent';
import fs from 'fs';
import path from 'path';

export interface DispatcherOptions {
  mode: 'local' | 'blaxel';
  targetDir: string;
  maxConcurrent?: number;
}

export interface WorkerResult {
  workerId: string;
  report: FindingReport | null;
  error?: string;
}

export async function dispatchWorkers(
  assignments: TaskAssignment[],
  options: DispatcherOptions,
): Promise<WorkerResult[]> {
  console.log(`[Dispatcher] Dispatching ${assignments.length} workers in ${options.mode} mode`);

  if (options.mode === 'local') {
    return dispatchLocal(assignments, options);
  }

  // Blaxel mode — placeholder for Phase 2
  throw new Error('Blaxel mode not yet implemented. Use local mode.');
}

async function dispatchLocal(
  assignments: TaskAssignment[],
  options: DispatcherOptions,
): Promise<WorkerResult[]> {
  const results: WorkerResult[] = [];
  // In local mode, run workers sequentially to avoid port conflicts
  // and pnpm lockfile contention from running in the same target directory
  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    console.log(`[Dispatcher] Worker ${i + 1}/${assignments.length}`);
    const result = await runLocalWorker(assignment, options.targetDir);
    results.push(result);
    // Wait for port release between sequential workers
    if (i < assignments.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return results;
}

async function runLocalWorker(
  assignment: TaskAssignment,
  targetDir: string,
): Promise<WorkerResult> {
  console.log(`[Dispatcher] Running worker ${assignment.worker_id} for ${assignment.attack_type} on ${assignment.target.endpoint}`);

  try {
    // Write task assignment to a temp location
    const taskDir = path.join(targetDir, '.dispatch', assignment.worker_id);
    fs.mkdirSync(taskDir, { recursive: true });
    const taskAssignmentPath = path.join(taskDir, 'task-assignment.json');
    fs.writeFileSync(
      taskAssignmentPath,
      JSON.stringify(assignment, null, 2)
    );

    // Call the pentester worker directly
    const report = await runPentesterWorker(taskAssignmentPath, targetDir);
    console.log(`[Dispatcher] Worker ${assignment.worker_id} completed successfully`);
    return { workerId: assignment.worker_id, report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      workerId: assignment.worker_id,
      report: null,
      error: message,
    };
  }
}

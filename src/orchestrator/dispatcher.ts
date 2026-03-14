import { TaskAssignment } from '../schemas/task-assignment';
import { FindingReport, FindingReportSchema } from '../schemas/finding-report';
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
  const maxConcurrent = options.maxConcurrent || 2;

  // Process in batches
  for (let i = 0; i < assignments.length; i += maxConcurrent) {
    const batch = assignments.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(assignment => runLocalWorker(assignment, options.targetDir))
    );
    results.push(...batchResults);
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
    fs.writeFileSync(
      path.join(taskDir, 'task-assignment.json'),
      JSON.stringify(assignment, null, 2)
    );

    // In MVP, we call the pentester worker directly (will be implemented in Task 1.5)
    // For now, return a placeholder
    const reportPath = path.join(taskDir, 'finding-report.json');
    if (fs.existsSync(reportPath)) {
      const raw = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      const report = FindingReportSchema.parse(raw);
      return { workerId: assignment.worker_id, report };
    }

    // Placeholder — pentester worker will populate this
    return {
      workerId: assignment.worker_id,
      report: null,
      error: 'Pentester worker not yet implemented',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      workerId: assignment.worker_id,
      report: null,
      error: message,
    };
  }
}

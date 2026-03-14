import { TaskAssignment } from '../schemas/task-assignment';
import { FindingReport, FindingReportSchema } from '../schemas/finding-report';
import { runPentesterWorker } from '../workers/pentester/agent';
import { SandboxInstance } from '@blaxel/core';
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

  return dispatchBlaxel(assignments, options);
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

// ---------------------------------------------------------------------------
// Blaxel Sandbox Mode
// ---------------------------------------------------------------------------

async function dispatchBlaxel(
  assignments: TaskAssignment[],
  options: DispatcherOptions,
): Promise<WorkerResult[]> {
  const maxConcurrent = options.maxConcurrent || 3;
  console.log(`[Dispatcher] Blaxel mode: ${assignments.length} workers, max ${maxConcurrent} concurrent`);

  // Run workers with concurrency limit
  const results: WorkerResult[] = [];
  for (let i = 0; i < assignments.length; i += maxConcurrent) {
    const batch = assignments.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(a => runBlaxelWorker(a, options.targetDir))
    );
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          workerId: 'unknown',
          report: null,
          error: result.reason?.message || String(result.reason),
        });
      }
    }
  }

  return results;
}

async function runBlaxelWorker(
  assignment: TaskAssignment,
  targetDir: string,
): Promise<WorkerResult> {
  const sandboxName = `dispatch-${assignment.worker_id}`.slice(0, 63).replace(/[^a-z0-9-]/g, '-');
  let sandbox: SandboxInstance | null = null;

  console.log(`[Blaxel] Creating sandbox ${sandboxName} for ${assignment.attack_type} on ${assignment.target.endpoint}`);

  try {
    // Create sandbox with port for target app
    sandbox = await SandboxInstance.createIfNotExists({
      name: sandboxName,
      region: process.env.BL_REGION || 'us-pdx-1',
      ports: [{ target: assignment.app_config.port, protocol: 'HTTP' }],
      ttl: '30m',
    });

    // Upload target app to sandbox
    console.log(`[Blaxel] Uploading target app to sandbox ${sandboxName}`);
    await uploadDirectory(sandbox, targetDir, '/app');

    // Write task assignment
    await sandbox.fs.write(
      '/dispatch/task-assignment.json',
      JSON.stringify(assignment, null, 2),
    );

    // Install dependencies
    console.log(`[Blaxel] Installing dependencies in sandbox ${sandboxName}`);
    const installResult = await sandbox.process.exec({
      name: `install-${assignment.worker_id}`,
      command: assignment.app_config.install,
      workingDir: '/app',
      waitForCompletion: true,
      timeout: 120, // seconds
    });
    if (installResult.logs) {
      console.log(`[Blaxel] Install output: ${installResult.logs.slice(0, 200)}`);
    }

    // Seed database if configured
    if (assignment.app_config.seed) {
      console.log(`[Blaxel] Seeding database in sandbox ${sandboxName}`);
      await sandbox.process.exec({
        name: `seed-${assignment.worker_id}`,
        command: assignment.app_config.seed,
        workingDir: '/app',
        waitForCompletion: true,
        timeout: 30, // seconds
      });
    }

    // Run the pentester worker
    console.log(`[Blaxel] Running pentester worker in sandbox ${sandboxName}`);
    const workerResult = await sandbox.process.exec({
      name: `pentester-${assignment.worker_id}`,
      command: 'npx tsx src/workers/pentester/cli.ts /dispatch/task-assignment.json /app',
      workingDir: '/app',
      waitForCompletion: true,
      timeout: 300, // 5 min per worker
    });

    console.log(`[Blaxel] Worker ${assignment.worker_id} process completed`);
    if (workerResult.logs) {
      console.log(`[Blaxel] logs: ${workerResult.logs.slice(-500)}`);
    }

    // Read finding report from sandbox
    const reportDir = `/dispatch/${assignment.worker_id}`;
    let reportJson: string;
    try {
      reportJson = await sandbox.fs.read(`${reportDir}/finding-report.json`);
    } catch {
      // Fallback: the worker writes report next to task-assignment.json
      reportJson = await sandbox.fs.read('/dispatch/finding-report.json');
    }

    const report = FindingReportSchema.parse(JSON.parse(reportJson));
    console.log(`[Blaxel] Worker ${assignment.worker_id} completed: ${report.findings.length} findings`);

    return { workerId: assignment.worker_id, report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Blaxel] Worker ${assignment.worker_id} failed: ${message}`);
    return {
      workerId: assignment.worker_id,
      report: null,
      error: message,
    };
  } finally {
    // Cleanup sandbox
    if (sandbox) {
      try {
        await sandbox.delete();
        console.log(`[Blaxel] Sandbox ${sandboxName} deleted`);
      } catch {
        // TTL will handle cleanup
      }
    }
  }
}

/**
 * Upload a local directory to a Blaxel sandbox.
 * Skips node_modules, .git, and other non-essential directories.
 */
async function uploadDirectory(
  sandbox: SandboxInstance,
  localDir: string,
  remotePath: string,
): Promise<void> {
  const SKIP = new Set(['node_modules', '.git', '.dispatch', 'data.db', 'data.db-shm', 'data.db-wal']);

  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;

    const localPath = path.join(localDir, entry.name);
    const sandboxPath = `${remotePath}/${entry.name}`;

    if (entry.isDirectory()) {
      await uploadDirectory(sandbox, localPath, sandboxPath);
    } else {
      const content = fs.readFileSync(localPath, 'utf-8');
      await sandbox.fs.write(sandboxPath, content);
    }
  }
}

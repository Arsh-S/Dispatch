import { TaskAssignment } from '../schemas/task-assignment';
import { FindingReport, FindingReportSchema } from '../schemas/finding-report';
import { runPentesterWorker } from '../workers/pentester/agent';
import { runClaudePentesterWorker } from '../workers/pentester/claude-agent';
import { SandboxInstance } from '@blaxel/core';
import { WorkerSupervisor } from '../diagnostics/worker-supervisor';
import { LoopDetector } from '../diagnostics/loop-detector.js';
import fs from 'fs';
import path from 'path';
import { DiagnosticsPoller } from '../diagnostics/poller.js';
import { DiagnosticsAggregator } from '../diagnostics/aggregator.js';
import type { AgentDiagnostics } from '../schemas/agent-diagnostics.js';
import { forwardDiagnostics, forwardLoopAlert, clearThrottle } from '../integrations/datadog/diagnostics-forwarder.js';

export interface DispatcherOptions {
  mode: 'local' | 'blaxel' | 'claude';
  targetDir: string;
  maxConcurrent?: number;
}

export interface WorkerResult {
  workerId: string;
  report: FindingReport | null;
  error?: string;
}

export interface DispatchCallbacks {
  onWorkerDispatched?: (assignment: TaskAssignment) => void;
  onWorkerComplete?: (result: WorkerResult) => void;
  onDiagnosticsUpdate?: (diagnostics: AgentDiagnostics) => void;
  onLoopDetected?: (workerId: string, reasons: string[]) => void;
}

// Shared supervisor instance — accessible from API endpoints for diagnostics
let activeSupervisor: WorkerSupervisor | null = null;

export function getActiveSupervisor(): WorkerSupervisor | null {
  return activeSupervisor;
}

export async function dispatchWorkers(
  assignments: TaskAssignment[],
  options: DispatcherOptions,
  callbacks?: DispatchCallbacks,
): Promise<WorkerResult[]> {
  console.log(`[Dispatcher] Dispatching ${assignments.length} workers in ${options.mode} mode`);

  if (options.mode === 'local') {
    return dispatchLocal(assignments, options, callbacks);
  }

  if (options.mode === 'claude') {
    return dispatchClaude(assignments, options, callbacks);
  }

  return dispatchBlaxel(assignments, options, callbacks);
}

async function dispatchLocal(
  assignments: TaskAssignment[],
  options: DispatcherOptions,
  callbacks?: DispatchCallbacks,
): Promise<WorkerResult[]> {
  // Set up diagnostics infrastructure
  const poller = new DiagnosticsPoller(5_000);
  const aggregator = new DiagnosticsAggregator();
  const loopDetector = new LoopDetector();

  poller.onUpdate((diag) => {
    aggregator.upsert(diag);
    callbacks?.onDiagnosticsUpdate?.(diag);

    // Forward metrics to Datadog (throttled to 30s per worker internally)
    forwardDiagnostics(diag);

    // Check for loops
    const healthStatus = loopDetector.getHealthStatus(diag);
    if (healthStatus === 'looping') {
      const reasons = loopDetector.evaluate(diag);
      const alert = loopDetector.buildAlert(diag, false);
      if (alert) {
        aggregator.addAlert(alert);
        forwardLoopAlert(alert);
      }
      callbacks?.onLoopDetected?.(diag.worker_id, reasons);
      console.warn(`[Dispatcher] Loop detected for worker ${diag.worker_id}: ${reasons.join(', ')}`);
    }
  });

  const results: WorkerResult[] = [];
  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    console.log(`[Dispatcher] Worker ${i + 1}/${assignments.length}`);
    callbacks?.onWorkerDispatched?.(assignment);

    // Register worker for diagnostics polling
    const taskDir = path.join(options.targetDir, '.dispatch', assignment.worker_id);
    const diagPath = path.join(taskDir, 'diagnostics.json');
    poller.registerWorker(assignment.worker_id, diagPath);

    if (i === 0) poller.start();

    const result = await runLocalWorker(assignment, options.targetDir);
    poller.unregisterWorker(assignment.worker_id);
    clearThrottle(assignment.worker_id);
    callbacks?.onWorkerComplete?.(result);
    results.push(result);
    if (i < assignments.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  poller.stop();
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
// Claude Agent Mode
// ---------------------------------------------------------------------------

/**
 * Dispatch workers using the Claude Code agent.
 *
 * Runs sequentially (same as local mode) so Claude API rate limits are
 * respected. Each worker invokes the Claude CLI in a subprocess and
 * validates output against Zod schemas.
 *
 * Creates a WorkerSupervisor that:
 * - Registers each worker's child process for kill control
 * - Runs diagnostics-based loop detection on a poll interval
 * - Escalates kills based on confidence: low→warn, medium→poison pill, high→SIGKILL
 * - Cleans up all workers on orchestrator shutdown (SIGINT/SIGTERM)
 */
async function dispatchClaude(
  assignments: TaskAssignment[],
  options: DispatcherOptions,
  callbacks?: DispatchCallbacks,
): Promise<WorkerResult[]> {
  const loopDetector = new LoopDetector();
  const supervisor = new WorkerSupervisor(loopDetector);
  activeSupervisor = supervisor;

  // Ensure cleanup on process exit
  const cleanup = () => supervisor.killAll();
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  supervisor.startPolling();

  const results: WorkerResult[] = [];
  try {
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      console.log(`[Dispatcher/Claude] Worker ${i + 1}/${assignments.length}`);
      callbacks?.onWorkerDispatched?.(assignment);
      const result = await runClaudeWorker(assignment, options.targetDir, supervisor);

      supervisor.markCompleted(assignment.worker_id);
      callbacks?.onWorkerComplete?.(result);
      results.push(result);
      if (i < assignments.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } finally {
    supervisor.stopPolling();
    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGTERM', cleanup);
    activeSupervisor = null;
  }

  return results;
}

async function runClaudeWorker(
  assignment: TaskAssignment,
  targetDir: string,
  supervisor: WorkerSupervisor,
): Promise<WorkerResult> {
  console.log(`[Dispatcher/Claude] Running Claude worker ${assignment.worker_id} for ${assignment.attack_type} on ${assignment.target.endpoint}`);

  const taskDir = path.join(targetDir, '.dispatch', assignment.worker_id);

  try {
    fs.mkdirSync(taskDir, { recursive: true });
    const taskAssignmentPath = path.join(taskDir, 'task-assignment.json');
    fs.writeFileSync(taskAssignmentPath, JSON.stringify(assignment, null, 2));

    const report = await runClaudePentesterWorker(
      taskAssignmentPath,
      targetDir,
      (child) => {
        supervisor.registerClaudeWorker(
          assignment.worker_id,
          'pentester',
          assignment.dispatch_run_id,
          child,
          taskDir,
          assignment.timeout_seconds * 1000,
        );
      },
    );

    console.log(`[Dispatcher/Claude] Worker ${assignment.worker_id} completed successfully`);
    return { workerId: assignment.worker_id, report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Check if the supervisor killed this worker
    const managed = supervisor.getWorker(assignment.worker_id);
    const wasKilled = managed?.status === 'killed' || managed?.status === 'timed_out';
    if (wasKilled) {
      console.warn(`[Dispatcher/Claude] Worker ${assignment.worker_id} was terminated by supervisor`);
    }

    return {
      workerId: assignment.worker_id,
      report: null,
      error: wasKilled ? `Terminated by supervisor: ${message}` : message,
    };
  }
}

// ---------------------------------------------------------------------------
// Blaxel Sandbox Mode
// ---------------------------------------------------------------------------

async function dispatchBlaxel(
  assignments: TaskAssignment[],
  options: DispatcherOptions,
  callbacks?: DispatchCallbacks,
): Promise<WorkerResult[]> {
  const maxConcurrent = options.maxConcurrent || 3;
  console.log(`[Dispatcher] Blaxel mode: ${assignments.length} workers, max ${maxConcurrent} concurrent`);

  const results: WorkerResult[] = [];
  for (let i = 0; i < assignments.length; i += maxConcurrent) {
    const batch = assignments.slice(i, i + maxConcurrent);
    batch.forEach(a => callbacks?.onWorkerDispatched?.(a));
    const batchResults = await Promise.allSettled(
      batch.map(a => runBlaxelWorker(a, options.targetDir))
    );
    for (let j = 0; j < batchResults.length; j++) {
      const settled = batchResults[j];
      if (settled.status === 'fulfilled') {
        callbacks?.onWorkerComplete?.(settled.value);
        results.push(settled.value);
      } else {
        const failedResult: WorkerResult = {
          workerId: batch[j]?.worker_id ?? 'unknown',
          report: null,
          error: settled.reason?.message || String(settled.reason),
        };
        callbacks?.onWorkerComplete?.(failedResult);
        results.push(failedResult);
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

    // Build env for sandbox (Datadog keys, etc.) so target app and worker get them
    const sandboxEnv = buildSandboxEnv();

    // Install dependencies
    console.log(`[Blaxel] Installing dependencies in sandbox ${sandboxName}`);
    const installResult = await sandbox.process.exec({
      name: `install-${assignment.worker_id}`,
      command: assignment.app_config.install,
      workingDir: '/app',
      waitForCompletion: true,
      timeout: 120, // seconds
      env: sandboxEnv,
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
        env: sandboxEnv,
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
      env: sandboxEnv,
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
 * Build env vars to pass to Blaxel sandbox processes.
 * Includes Datadog keys so target app and worker can forward logs/traces.
 */
function buildSandboxEnv(): Record<string, string> {
  const keys = [
    'DATADOG_API_KEY',
    'DD_APPLICATION_KEY',
    'DD_SITE',
    'DD_ENV',
    'DD_SERVICE',
    'DD_AGENT_HOST',
    'JWT_SECRET',
    'PORT',
  ];
  const env: Record<string, string> = {};
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== '') env[k] = v;
  }
  return env;
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

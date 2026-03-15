/**
 * WorkerSupervisor — owns the kill chain for Claude Code worker subagents.
 *
 * Bridges the diagnostics/loop-detection system to the actual process
 * termination mechanisms. Supports three execution contexts:
 *
 *   1. Claude mode (local subprocess) — process group SIGTERM → SIGKILL
 *   2. Blaxel sandbox mode — sandbox.delete()
 *   3. Orchestrator shutdown — killAll()
 *
 * Kill escalation based on number of loop-detection reasons:
 *   1 reason  → log warning, no kill
 *   2 reasons → write poison pill, 30s grace period, then force kill
 *   3+ reasons → immediate SIGTERM → 5s → SIGKILL
 */

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import type { LoopAlert, AgentDiagnostics } from '../schemas/agent-diagnostics';
import { LoopDetector } from './loop-detector';

// Blaxel SandboxInstance — kept as a loose type so we don't import @blaxel/core here
interface SandboxHandle {
  delete(): Promise<void>;
  fs: { write(path: string, content: string): Promise<void> };
}

export type WorkerStatus = 'running' | 'grace_period' | 'killed' | 'timed_out' | 'completed';

export interface ManagedWorker {
  workerId: string;
  workerType: 'pentester' | 'constructor';
  dispatchRunId: string;
  workerDir: string;
  startedAt: number;
  status: WorkerStatus;

  // Claude mode (local subprocess)
  pid?: number;
  childProcess?: ChildProcess;

  // Blaxel mode
  sandbox?: SandboxHandle;

  // Timers
  hardTimeoutHandle?: ReturnType<typeof setTimeout>;
  gracePeriodHandle?: ReturnType<typeof setTimeout>;
}

export interface SupervisorOptions {
  /** Default hard timeout per worker (ms). Overridden by task assignment. */
  defaultTimeoutMs?: number;
  /** Grace period before force-kill after poison pill (ms). Default: 30_000. */
  gracePeriodMs?: number;
  /** Interval to poll diagnostics and run loop detection (ms). Default: 10_000. */
  pollIntervalMs?: number;
}

const DEFAULTS: Required<SupervisorOptions> = {
  defaultTimeoutMs: 300_000,   // 5 minutes
  gracePeriodMs: 30_000,       // 30 seconds
  pollIntervalMs: 10_000,      // 10 seconds
};

export class WorkerSupervisor extends EventEmitter {
  private workers = new Map<string, ManagedWorker>();
  private loopDetector: LoopDetector;
  private opts: Required<SupervisorOptions>;
  private pollHandle?: ReturnType<typeof setInterval>;
  private alerts: LoopAlert[] = [];
  private diagnosticsReader?: (workerId: string) => AgentDiagnostics | null;

  constructor(
    loopDetector?: LoopDetector,
    opts?: SupervisorOptions,
  ) {
    super();
    this.loopDetector = loopDetector ?? new LoopDetector();
    this.opts = { ...DEFAULTS, ...opts };
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerClaudeWorker(
    workerId: string,
    workerType: 'pentester' | 'constructor',
    dispatchRunId: string,
    childProcess: ChildProcess,
    workerDir: string,
    timeoutMs?: number,
  ): void {
    const worker: ManagedWorker = {
      workerId,
      workerType,
      dispatchRunId,
      workerDir,
      startedAt: Date.now(),
      status: 'running',
      pid: childProcess.pid,
      childProcess,
    };

    this.workers.set(workerId, worker);
    this.scheduleHardTimeout(worker, timeoutMs ?? this.opts.defaultTimeoutMs);

    console.log(`[Supervisor] Registered Claude worker ${workerId} (pid=${childProcess.pid})`);
  }

  registerSandboxWorker(
    workerId: string,
    workerType: 'pentester' | 'constructor',
    dispatchRunId: string,
    sandbox: SandboxHandle,
    workerDir: string,
    timeoutMs?: number,
  ): void {
    const worker: ManagedWorker = {
      workerId,
      workerType,
      dispatchRunId,
      workerDir,
      startedAt: Date.now(),
      status: 'running',
      sandbox,
    };

    this.workers.set(workerId, worker);
    this.scheduleHardTimeout(worker, timeoutMs ?? this.opts.defaultTimeoutMs);

    console.log(`[Supervisor] Registered sandbox worker ${workerId}`);
  }

  markCompleted(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.status = 'completed';
    this.clearTimers(worker);
    console.log(`[Supervisor] Worker ${workerId} marked completed`);
  }

  unregister(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.clearTimers(worker);
      this.workers.delete(workerId);
    }
  }

  // ---------------------------------------------------------------------------
  // Diagnostics polling
  // ---------------------------------------------------------------------------

  setDiagnosticsReader(reader: (workerId: string) => AgentDiagnostics | null): void {
    this.diagnosticsReader = reader;
  }

  startPolling(): void {
    if (this.pollHandle) return;
    this.pollHandle = setInterval(() => this.pollAndEvaluate(), this.opts.pollIntervalMs);
    console.log(`[Supervisor] Polling started (every ${this.opts.pollIntervalMs}ms)`);
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
      console.log('[Supervisor] Polling stopped');
    }
  }

  private pollAndEvaluate(): void {
    if (!this.diagnosticsReader) return;

    this.workers.forEach((worker, workerId) => {
      if (worker.status !== 'running') return;

      const diagnostics = this.diagnosticsReader!(workerId);
      if (!diagnostics) return;

      const reasons = this.loopDetector.evaluate(diagnostics);
      if (reasons.length === 0) return;

      const alert = this.loopDetector.buildAlert(diagnostics, false);
      if (!alert) return;

      this.onAlert(alert, reasons.length);
    });
  }

  // ---------------------------------------------------------------------------
  // Alert handling — the kill decision
  // ---------------------------------------------------------------------------

  onAlert(alert: LoopAlert, reasonCount: number): void {
    const worker = this.workers.get(alert.worker_id);
    if (!worker || worker.status !== 'running') return;

    console.log(
      `[Supervisor] Alert for ${alert.worker_id}: ${reasonCount} reason(s)=[${alert.reasons.join('; ')}]`,
    );

    this.alerts.push(alert);
    this.emit('alert', alert);

    if (reasonCount >= 3) {
      // High confidence — immediate kill
      this.forceKill(worker, alert);
    } else if (reasonCount === 2) {
      // Medium confidence — poison pill + grace period
      this.requestGracefulShutdown(worker, alert);
    } else {
      // Low confidence — warning only
      this.emit('warning', alert);
    }
  }

  // ---------------------------------------------------------------------------
  // Graceful shutdown — poison pill + grace period
  // ---------------------------------------------------------------------------

  private requestGracefulShutdown(worker: ManagedWorker, alert: LoopAlert): void {
    if (worker.status !== 'running') return;
    worker.status = 'grace_period';

    console.log(
      `[Supervisor] Requesting graceful shutdown for ${worker.workerId} (${this.opts.gracePeriodMs}ms grace)`,
    );

    this.writePoisonPill(worker, alert);

    worker.gracePeriodHandle = setTimeout(() => {
      if (worker.status === 'grace_period') {
        console.log(`[Supervisor] Grace period expired for ${worker.workerId}, force killing`);
        this.forceKill(worker, alert);
      }
    }, this.opts.gracePeriodMs);

    this.emit('graceful_shutdown', { workerId: worker.workerId, alert });
  }

  private writePoisonPill(worker: ManagedWorker, alert: LoopAlert): void {
    const abortPayload = JSON.stringify({
      reasons: alert.reasons,
      message: 'Supervisor detected potential infinite loop. Write partial results and exit.',
      partial_results_requested: true,
      triggered_at: alert.triggered_at,
    }, null, 2);

    if (worker.sandbox) {
      worker.sandbox.fs.write('/dispatch/ABORT', abortPayload).catch((err) => {
        console.warn(`[Supervisor] Failed to write poison pill to sandbox for ${worker.workerId}: ${err}`);
      });
    } else {
      const abortDir = path.join(worker.workerDir, '.dispatch');
      try {
        fs.mkdirSync(abortDir, { recursive: true });
        fs.writeFileSync(path.join(abortDir, 'ABORT'), abortPayload);
      } catch (err) {
        console.warn(`[Supervisor] Failed to write poison pill for ${worker.workerId}: ${err}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Force kill — process group SIGTERM → SIGKILL or sandbox.delete()
  // ---------------------------------------------------------------------------

  private forceKill(worker: ManagedWorker, alert: LoopAlert): void {
    if (worker.status === 'killed' || worker.status === 'completed') return;

    const previousStatus = worker.status;
    worker.status = 'killed';
    alert.auto_killed = true;
    this.clearTimers(worker);

    console.log(
      `[Supervisor] Force killing ${worker.workerId} (was ${previousStatus})`,
    );

    if (worker.sandbox) {
      this.killSandbox(worker);
    } else if (worker.childProcess || worker.pid) {
      this.killProcessGroup(worker);
    }

    this.emit('killed', { workerId: worker.workerId, alert });
  }

  private killSandbox(worker: ManagedWorker): void {
    if (!worker.sandbox) return;
    worker.sandbox.delete().catch((err) => {
      console.warn(`[Supervisor] Failed to delete sandbox for ${worker.workerId}: ${err}`);
    });
  }

  private killProcessGroup(worker: ManagedWorker): void {
    const pid = worker.pid;
    if (!pid) return;

    try {
      process.kill(-pid, 'SIGTERM');
      console.log(`[Supervisor] Sent SIGTERM to process group -${pid}`);
    } catch (err: any) {
      if (err.code !== 'ESRCH') {
        console.warn(`[Supervisor] SIGTERM failed for -${pid}: ${err.message}`);
      }
      return;
    }

    setTimeout(() => {
      try {
        process.kill(-pid, 0);
        process.kill(-pid, 'SIGKILL');
        console.log(`[Supervisor] Sent SIGKILL to process group -${pid}`);
      } catch {
        // Process is dead
      }
    }, 5000);
  }

  // ---------------------------------------------------------------------------
  // Hard timeout (wall-clock safety net, independent of diagnostics)
  // ---------------------------------------------------------------------------

  private scheduleHardTimeout(worker: ManagedWorker, timeoutMs: number): void {
    worker.hardTimeoutHandle = setTimeout(() => {
      if (worker.status !== 'running' && worker.status !== 'grace_period') return;

      console.log(`[Supervisor] Hard timeout (${timeoutMs}ms) reached for ${worker.workerId}`);
      worker.status = 'timed_out';

      const syntheticAlert: LoopAlert = {
        worker_id: worker.workerId,
        worker_type: worker.workerType,
        dispatch_run_id: worker.dispatchRunId,
        triggered_at: new Date().toISOString(),
        reasons: [`Wall clock timeout: ${Math.round(timeoutMs / 1000)}s`],
        diagnostics: {
          worker_id: worker.workerId,
          worker_type: worker.workerType,
          dispatch_run_id: worker.dispatchRunId,
          started_at: new Date(worker.startedAt).toISOString(),
          updated_at: new Date().toISOString(),
          wall_clock_seconds: Math.round((Date.now() - worker.startedAt) / 1000),
          trace_length: 0,
          tool_calls: {},
          total_tool_calls: 0,
          lines_added: 0,
          lines_removed: 0,
          unique_files_touched: [],
          repeated_calls: 0,
          error_count: 0,
          consecutive_errors: 0,
          phase: 'unknown',
          findings_so_far: 0,
          last_action: 'timeout',
        },
        auto_killed: true,
      };

      this.forceKill(worker, syntheticAlert);
      this.alerts.push(syntheticAlert);
      this.emit('timeout', { workerId: worker.workerId, alert: syntheticAlert });
    }, timeoutMs);
  }

  // ---------------------------------------------------------------------------
  // Orchestrator shutdown — kill everything
  // ---------------------------------------------------------------------------

  killAll(): void {
    console.log(`[Supervisor] Killing all ${this.workers.size} workers`);
    this.stopPolling();

    this.workers.forEach((worker) => {
      if (worker.status === 'running' || worker.status === 'grace_period') {
        const alert: LoopAlert = {
          worker_id: worker.workerId,
          worker_type: worker.workerType,
          dispatch_run_id: worker.dispatchRunId,
          triggered_at: new Date().toISOString(),
          reasons: ['Orchestrator shutdown'],
          diagnostics: {
            worker_id: worker.workerId,
            worker_type: worker.workerType,
            dispatch_run_id: worker.dispatchRunId,
            started_at: new Date(worker.startedAt).toISOString(),
            updated_at: new Date().toISOString(),
            wall_clock_seconds: Math.round((Date.now() - worker.startedAt) / 1000),
            trace_length: 0,
            tool_calls: {},
            total_tool_calls: 0,
            lines_added: 0,
            lines_removed: 0,
            unique_files_touched: [],
            repeated_calls: 0,
            error_count: 0,
            consecutive_errors: 0,
            phase: 'unknown',
            findings_so_far: 0,
            last_action: 'orchestrator_shutdown',
          },
          auto_killed: true,
        };
        this.forceKill(worker, alert);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  getWorker(workerId: string): ManagedWorker | undefined {
    return this.workers.get(workerId);
  }

  getAlerts(): LoopAlert[] {
    return this.alerts;
  }

  getRunningWorkers(): ManagedWorker[] {
    return Array.from(this.workers.values()).filter(
      (w) => w.status === 'running' || w.status === 'grace_period',
    );
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private clearTimers(worker: ManagedWorker): void {
    if (worker.hardTimeoutHandle) {
      clearTimeout(worker.hardTimeoutHandle);
      worker.hardTimeoutHandle = undefined;
    }
    if (worker.gracePeriodHandle) {
      clearTimeout(worker.gracePeriodHandle);
      worker.gracePeriodHandle = undefined;
    }
  }
}

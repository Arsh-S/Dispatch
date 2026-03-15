import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AgentDiagnostics } from '../schemas/agent-diagnostics.js';

/**
 * DiagnosticsAccumulator — runs inside a worker (pentester or constructor)
 * to track per-agent metrics. Flushes to a JSON file that the orchestrator
 * polls via DiagnosticsPoller.
 */
export class DiagnosticsAccumulator {
  private workerId: string;
  private workerType: 'pentester' | 'constructor';
  private dispatchRunId: string;
  private outputPath: string;

  private startedAt: string;
  private toolCalls: Map<string, number> = new Map();
  private totalToolCalls = 0;
  private linesAdded = 0;
  private linesRemoved = 0;
  private filesTouched: Set<string> = new Set();
  private callSignatures: Map<string, number> = new Map();
  private repeatedCalls = 0;
  private errorCount = 0;
  private consecutiveErrors = 0;
  private phase = 'init';
  private findingsSoFar = 0;
  private lastAction = '';
  private traceLength = 0;

  private flushCounter = 0;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  private static readonly FLUSH_EVERY_N_CALLS = 5;
  private static readonly FLUSH_INTERVAL_MS = 10_000;

  constructor(
    workerId: string,
    workerType: 'pentester' | 'constructor',
    dispatchRunId: string,
    outputPath: string,
  ) {
    this.workerId = workerId;
    this.workerType = workerType;
    this.dispatchRunId = dispatchRunId;
    this.outputPath = outputPath;
    this.startedAt = new Date().toISOString();

    // Ensure output directory exists
    const dir = path.dirname(this.outputPath);
    fs.mkdirSync(dir, { recursive: true });

    // Start auto-flush interval
    this.flushInterval = setInterval(() => this.flush(), DiagnosticsAccumulator.FLUSH_INTERVAL_MS);

    // Initial flush
    this.flush();
  }

  recordToolCall(toolName: string, args?: string): void {
    if (this.stopped) return;

    this.traceLength++;
    this.totalToolCalls++;
    this.toolCalls.set(toolName, (this.toolCalls.get(toolName) ?? 0) + 1);

    // Track repeated calls (same tool + args)
    if (args !== undefined) {
      const sig = `${toolName}:${args}`;
      const prev = this.callSignatures.get(sig) ?? 0;
      this.callSignatures.set(sig, prev + 1);
      if (prev > 0) {
        this.repeatedCalls++;
      }
    }

    this.flushCounter++;
    if (this.flushCounter >= DiagnosticsAccumulator.FLUSH_EVERY_N_CALLS) {
      this.flushCounter = 0;
      this.flush();
    }
  }

  recordLineEdits(added: number, removed: number): void {
    if (this.stopped) return;
    this.linesAdded += added;
    this.linesRemoved += removed;
  }

  recordFileTouch(filePath: string): void {
    if (this.stopped) return;
    this.filesTouched.add(filePath);
  }

  recordError(): void {
    if (this.stopped) return;
    this.errorCount++;
    this.consecutiveErrors++;
  }

  clearConsecutiveErrors(): void {
    this.consecutiveErrors = 0;
  }

  recordFinding(): void {
    if (this.stopped) return;
    this.findingsSoFar++;
  }

  setPhase(phase: string): void {
    if (this.stopped) return;
    this.phase = phase;
  }

  setLastAction(action: string): void {
    if (this.stopped) return;
    this.lastAction = action;
  }

  getSnapshot(): AgentDiagnostics {
    const now = new Date();
    const started = new Date(this.startedAt);
    const wallClockSeconds = Math.round((now.getTime() - started.getTime()) / 1000);

    return {
      worker_id: this.workerId,
      worker_type: this.workerType,
      dispatch_run_id: this.dispatchRunId,
      started_at: this.startedAt,
      updated_at: now.toISOString(),
      wall_clock_seconds: wallClockSeconds,
      trace_length: this.traceLength,
      tool_calls: Object.fromEntries(this.toolCalls),
      total_tool_calls: this.totalToolCalls,
      lines_added: this.linesAdded,
      lines_removed: this.linesRemoved,
      unique_files_touched: Array.from(this.filesTouched),
      repeated_calls: this.repeatedCalls,
      error_count: this.errorCount,
      consecutive_errors: this.consecutiveErrors,
      phase: this.phase,
      findings_so_far: this.findingsSoFar,
      last_action: this.lastAction,
    };
  }

  /**
   * Atomic write: write to temp file then rename to avoid partial reads.
   */
  flush(): void {
    if (this.stopped) return;

    try {
      const snapshot = this.getSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      const tmpPath = path.join(
        path.dirname(this.outputPath),
        `.diagnostics-${this.workerId}-${process.pid}.tmp`,
      );
      fs.writeFileSync(tmpPath, json);
      fs.renameSync(tmpPath, this.outputPath);
    } catch (err) {
      // Best-effort — don't crash the worker if diagnostics write fails
      console.error(`[DiagnosticsAccumulator] flush error: ${err}`);
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    try {
      const snapshot = this.getSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      const tmpPath = path.join(
        path.dirname(this.outputPath),
        `.diagnostics-${this.workerId}-${process.pid}.tmp`,
      );
      fs.writeFileSync(tmpPath, json);
      fs.renameSync(tmpPath, this.outputPath);
    } catch {
      // best-effort
    }
  }
}

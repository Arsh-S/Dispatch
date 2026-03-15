import fs from 'fs';
import { AgentDiagnosticsSchema, type AgentDiagnostics } from '../schemas/agent-diagnostics.js';

export type DiagnosticsCallback = (diagnostics: AgentDiagnostics) => void;

/**
 * DiagnosticsPoller — orchestrator-side component that periodically reads
 * diagnostics JSON files from worker sandboxes/local paths and emits updates.
 */
export class DiagnosticsPoller {
  private workers: Map<string, string> = new Map(); // worker_id -> diagnostics file path
  private interval: ReturnType<typeof setInterval> | null = null;
  private callbacks: DiagnosticsCallback[] = [];
  private pollIntervalMs: number;
  private stopped = false;

  constructor(pollIntervalMs = 5_000) {
    this.pollIntervalMs = pollIntervalMs;
  }

  onUpdate(callback: DiagnosticsCallback): void {
    this.callbacks.push(callback);
  }

  registerWorker(workerId: string, diagnosticsPath: string): void {
    this.workers.set(workerId, diagnosticsPath);
  }

  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId);
  }

  start(): void {
    if (this.interval || this.stopped) return;
    this.interval = setInterval(() => this.pollAll(), this.pollIntervalMs);
    // Initial poll
    this.pollAll();
  }

  stop(): void {
    this.stopped = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  pollAll(): void {
    for (const [workerId, filePath] of this.workers) {
      try {
        if (!fs.existsSync(filePath)) continue;

        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = AgentDiagnosticsSchema.safeParse(JSON.parse(raw));

        if (!parsed.success) {
          // Stale or partial write — skip gracefully
          continue;
        }

        for (const cb of this.callbacks) {
          cb(parsed.data);
        }
      } catch {
        // Parse error or file read race condition — skip this cycle
      }
    }
  }

  getRegisteredWorkers(): string[] {
    return Array.from(this.workers.keys());
  }
}

import type { AgentDiagnostics } from '../schemas/agent-diagnostics.js';
import type { LoopAlert } from '../schemas/agent-diagnostics.js';

/**
 * DiagnosticsAggregator — in-memory store for agent diagnostics snapshots
 * and loop alerts. Follows the logStore pattern used elsewhere in the project.
 */
export class DiagnosticsAggregator {
  private diagnostics: Map<string, AgentDiagnostics> = new Map();
  private alerts: LoopAlert[] = [];

  upsert(diag: AgentDiagnostics): void {
    this.diagnostics.set(diag.worker_id, diag);
  }

  get(workerId: string): AgentDiagnostics | undefined {
    return this.diagnostics.get(workerId);
  }

  getAll(): AgentDiagnostics[] {
    return Array.from(this.diagnostics.values());
  }

  getByRunId(dispatchRunId: string): AgentDiagnostics[] {
    return this.getAll().filter(d => d.dispatch_run_id === dispatchRunId);
  }

  getActive(): AgentDiagnostics[] {
    return this.getAll().filter(d => {
      const phase = d.phase;
      return phase !== 'complete' && phase !== 'error';
    });
  }

  remove(workerId: string): boolean {
    return this.diagnostics.delete(workerId);
  }

  clear(): void {
    this.diagnostics.clear();
  }

  // -- Alerts --

  addAlert(alert: LoopAlert): void {
    this.alerts.push(alert);
  }

  getAlerts(): LoopAlert[] {
    return [...this.alerts];
  }

  getAlertsByRunId(dispatchRunId: string): LoopAlert[] {
    return this.alerts.filter(a => a.dispatch_run_id === dispatchRunId);
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  // -- Stats --

  size(): number {
    return this.diagnostics.size;
  }

  alertCount(): number {
    return this.alerts.length;
  }
}

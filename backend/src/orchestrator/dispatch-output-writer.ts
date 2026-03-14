import fs from 'fs';
import type { PreReconDeliverable } from '../schemas/pre-recon-deliverable';
import type { TaskAssignment } from '../schemas/task-assignment';
import type { FindingReport } from '../schemas/finding-report';
import type { WorkerResult } from './dispatcher';
import type { MergedReport } from './collector';
import type { DispatchOutput, RunStatus, RunMetrics, TriggeredBy } from './graph-types';
import { buildGraphData } from './graph-builder';

const emptyMetrics: RunMetrics = {
  routesDiscovered: 0,
  workersActive: 0,
  findingsFound: 0,
  ticketsCreated: 0,
  prsOpened: 0,
  retestsPassed: 0,
};

export class DispatchOutputWriter {
  private output: DispatchOutput;
  private outputPath: string;
  private preRecon: PreReconDeliverable | null = null;
  private assignments: TaskAssignment[] = [];
  private dispatchedWorkerIds: Set<string> = new Set();
  private completedResults: WorkerResult[] = [];

  constructor(outputPath: string, dispatchRunId: string, repoName?: string, triggeredBy?: TriggeredBy) {
    this.outputPath = outputPath;
    this.output = {
      dispatch_run_id: dispatchRunId,
      status: 'idle',
      started_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      repo: { name: repoName ?? 'unknown' },
      task_assignments: [],
      finding_reports: [],
      findings: [],
      metrics: { ...emptyMetrics },
    };
    this.write();
  }

  private write(): void {
    fs.writeFileSync(this.outputPath, JSON.stringify(this.output, null, 2));
  }

  private rebuildGraphData(): void {
    const mergedReport = this.buildMergedReportSnapshot();
    this.output.graph_data = buildGraphData(
      this.output.dispatch_run_id,
      this.preRecon,
      this.assignments,
      this.getGraphWorkerResults(),
      mergedReport,
    );
  }

  private getGraphWorkerResults(): WorkerResult[] {
    const results: WorkerResult[] = [...this.completedResults];
    const completedIds = new Set(this.completedResults.map(r => r.workerId));
    for (const workerId of this.dispatchedWorkerIds) {
      if (!completedIds.has(workerId)) {
        results.push({ workerId, report: null });
      }
    }
    return results;
  }

  private buildMergedReportSnapshot(): MergedReport | null {
    const completedReports = this.completedResults
      .filter(r => r.report !== null)
      .map(r => r.report as FindingReport);

    if (completedReports.length === 0) return null;

    const allFindings = completedReports.flatMap(r => r.findings);
    return {
      dispatch_run_id: this.output.dispatch_run_id,
      completed_at: new Date().toISOString(),
      duration_seconds: 0,
      total_workers: completedReports.length,
      findings: allFindings,
      clean_endpoints: completedReports.flatMap(r => r.clean_endpoints),
      worker_errors: [],
      summary: {
        critical: allFindings.filter(f => f.severity === 'CRITICAL').length,
        high: allFindings.filter(f => f.severity === 'HIGH').length,
        medium: allFindings.filter(f => f.severity === 'MEDIUM').length,
        low: allFindings.filter(f => f.severity === 'LOW').length,
        total_endpoints: new Set(allFindings.map(f => f.location.endpoint)).size,
        vulnerable_endpoints: new Set(allFindings.map(f => f.location.endpoint)).size,
        clean_endpoints: 0,
      },
    };
  }

  private updateMetrics(): void {
    const completedReports = this.completedResults
      .filter(r => r.report !== null)
      .map(r => r.report as FindingReport);

    const allFindings = completedReports.flatMap(r => r.findings);

    this.output.metrics = {
      routesDiscovered: this.preRecon?.route_map.length ?? 0,
      workersActive: this.dispatchedWorkerIds.size - this.completedResults.length,
      findingsFound: allFindings.length,
      ticketsCreated: 0,
      prsOpened: 0,
      retestsPassed: 0,
    };
  }

  writePhase(phase: RunStatus, data?: Partial<DispatchOutput>): void {
    this.output.status = phase;
    if (data) Object.assign(this.output, data);
    this.updateMetrics();
    this.rebuildGraphData();
    this.write();
  }

  onPreReconComplete(preRecon: PreReconDeliverable): void {
    this.preRecon = preRecon;
    this.output.pre_recon = preRecon;
    this.output.status = 'planning';
    this.updateMetrics();
    this.rebuildGraphData();
    this.write();
  }

  onAttackMatrixComplete(assignments: TaskAssignment[]): void {
    this.assignments = assignments;
    this.output.task_assignments = assignments;
    this.output.status = 'executing';
    this.updateMetrics();
    this.rebuildGraphData();
    this.write();
  }

  onWorkerDispatched(assignment: TaskAssignment): void {
    this.dispatchedWorkerIds.add(assignment.worker_id);
    this.updateMetrics();
    this.rebuildGraphData();
    this.write();
  }

  onWorkerComplete(result: WorkerResult): void {
    this.completedResults.push(result);

    if (result.report) {
      this.output.finding_reports.push(result.report);
      this.output.findings.push(...result.report.findings);
    }

    this.updateMetrics();
    this.rebuildGraphData();
    this.write();
  }

  onComplete(mergedReport: MergedReport | null, workerResults: WorkerResult[]): void {
    this.completedResults = workerResults;
    this.output.status = 'completed';
    this.output.completed_at = new Date().toISOString();

    if (mergedReport) {
      this.output.findings = mergedReport.findings;
    }

    this.output.graph_data = buildGraphData(
      this.output.dispatch_run_id,
      this.preRecon,
      this.assignments,
      workerResults,
      mergedReport,
    );
    this.updateMetrics();
    this.write();
  }

  getCurrentOutput(): DispatchOutput {
    return this.output;
  }
}

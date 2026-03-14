import type { PreReconDeliverable } from '../schemas/pre-recon-deliverable';
import type { TaskAssignment } from '../schemas/task-assignment';
import type { WorkerResult } from './dispatcher';
import type { MergedReport } from './collector';
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphCluster,
  NodeStatus,
  Severity,
  NodeId,
  ClusterId,
} from './graph-types';

/**
 * Builds a GraphData snapshot from the current orchestrator state.
 * Pure function — no side effects.
 */
export function buildGraphData(
  dispatchRunId: string,
  preRecon: PreReconDeliverable | null,
  assignments: TaskAssignment[],
  workerResults: WorkerResult[],
  mergedReport: MergedReport | null,
): GraphData {
  const nodes: Record<NodeId, GraphNode> = {};
  const edges: GraphEdge[] = [];
  const clusters: Record<ClusterId, GraphCluster> = {};

  const resultByWorkerId = new Map(workerResults.map(r => [r.workerId, r]));

  // 1. Orchestrator node (always present, center of radial layout)
  nodes['orchestrator'] = {
    id: 'orchestrator',
    label: 'Orchestrator',
    type: 'orchestrator',
    status: 'running',
    position: { x: 400, y: 300 },
    size: 48,
    meta: preRecon
      ? {
          pre_recon: {
            route_count: preRecon.route_map.length,
            risk_count: preRecon.risk_signals.length,
            briefing_notes: preRecon.briefing_notes,
          },
        }
      : undefined,
  };

  // 2. Group assignments by attack_type
  const byAttackType = new Map<string, TaskAssignment[]>();
  for (const a of assignments) {
    const group = byAttackType.get(a.attack_type) ?? [];
    group.push(a);
    byAttackType.set(a.attack_type, group);
  }

  const clusterIds = [...byAttackType.keys()];
  const clusterCount = clusterIds.length || 1;

  clusterIds.forEach((attackType, clusterIndex) => {
    const clusterId = slugify(attackType);
    const clusterAssignments = byAttackType.get(attackType)!;

    // Determine cluster status from its workers
    const clusterWorkerStatuses = clusterAssignments.map(a =>
      resolveWorkerStatus(a.worker_id, resultByWorkerId),
    );
    const clusterStatus = aggregateClusterStatus(clusterWorkerStatuses);

    clusters[clusterId] = {
      id: clusterId,
      label: humanizeAttackType(attackType),
      type: 'cluster',
      status: clusterStatus,
    };

    // Radial position for this cluster around the orchestrator
    const clusterAngle = (2 * Math.PI * clusterIndex) / clusterCount - Math.PI / 2;
    const clusterRadius = 180;
    const cx = 400 + Math.cos(clusterAngle) * clusterRadius;
    const cy = 300 + Math.sin(clusterAngle) * clusterRadius;

    // Cluster node (for graph rendering)
    nodes[clusterId] = {
      id: clusterId,
      label: humanizeAttackType(attackType),
      type: 'cluster',
      clusterId,
      status: clusterStatus,
      position: { x: cx, y: cy },
      size: 28,
      meta: {
        attack_type: attackType,
        worker_ids: clusterAssignments.map(a => a.worker_id),
        endpoint_count: clusterAssignments.length,
      },
    };

    // Edge: orchestrator → cluster
    edges.push({
      id: `e-orchestrator-${clusterId}`,
      from: 'orchestrator',
      to: clusterId,
      kind: 'orchestrator',
    });

    // 3. Worker nodes within each cluster
    const workerCount = clusterAssignments.length || 1;
    clusterAssignments.forEach((assignment, workerIndex) => {
      const workerStatus = resolveWorkerStatus(assignment.worker_id, resultByWorkerId);

      const workerReport = resultByWorkerId.get(assignment.worker_id)?.report ?? null;
      nodes[assignment.worker_id] = {
        id: assignment.worker_id,
        label: `${attackType}: ${assignment.target.endpoint}`,
        type: 'worker',
        clusterId,
        status: workerStatus,
        position: radialChildPosition(cx, cy, workerIndex, workerCount, 70),
        size: 14,
        meta: {
          assignment: {
            attack_type: assignment.attack_type,
            briefing: assignment.briefing,
            target: assignment.target,
          },
          report: workerReport
            ? {
                status: workerReport.status,
                duration_seconds: workerReport.duration_seconds,
                findings_count: workerReport.findings.length,
                clean_count: workerReport.clean_endpoints.length,
              }
            : null,
        },
      };

      // Edge: cluster → worker
      edges.push({
        id: `e-${clusterId}-${assignment.worker_id}`,
        from: clusterId,
        to: assignment.worker_id,
        kind: 'worker',
      });
    });
  });

  // 4. Finding nodes from mergedReport
  if (mergedReport) {
    // Build a lookup: worker_id → set of finding_ids
    // finding_reports in workerResults link workers to findings
    const workerToFindings = buildWorkerFindingMap(workerResults, mergedReport);

    mergedReport.findings.forEach((finding, findingIndex) => {
      const nodeId = finding.finding_id;
      nodes[nodeId] = {
        id: nodeId,
        label: `${finding.vuln_type}: ${finding.location.endpoint}`,
        type: 'finding',
        status: finding.exploit_confidence === 'confirmed' ? 'failed' : 'warning',
        severity: finding.severity.toLowerCase() as Severity,
        meta: { finding },
        position: { x: 700, y: 120 + findingIndex * 80 },
        size: 18,
      };

      // 5. Edge: worker → finding
      const parentWorkerId = workerToFindings.get(finding.finding_id);
      if (parentWorkerId && nodes[parentWorkerId]) {
        edges.push({
          id: `e-${parentWorkerId}-${nodeId}`,
          from: parentWorkerId,
          to: nodeId,
          kind: 'finding',
        });
      }
    });
  }

  return { nodes, edges, clusters };
}

function resolveWorkerStatus(
  workerId: string,
  resultByWorkerId: Map<string, WorkerResult>,
): NodeStatus {
  const result = resultByWorkerId.get(workerId);
  if (!result) return 'queued';
  if (result.error) return 'failed';
  if (result.report) return 'success';
  return 'running';
}

function aggregateClusterStatus(statuses: NodeStatus[]): NodeStatus {
  if (statuses.length === 0) return 'idle';
  if (statuses.some(s => s === 'running' || s === 'queued')) return 'running';
  if (statuses.every(s => s === 'success')) return 'success';
  if (statuses.some(s => s === 'failed')) return 'failed';
  return 'idle';
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function humanizeAttackType(attackType: string): string {
  return attackType
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') + ' Workers';
}

function radialChildPosition(
  cx: number,
  cy: number,
  index: number,
  count: number,
  radius: number,
): { x: number; y: number } {
  if (count === 1) return { x: cx + radius, y: cy };
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

/**
 * Maps finding_id → worker_id by matching findings from the merged report
 * back to the workers that produced them via their finding_reports.
 */
function buildWorkerFindingMap(
  workerResults: WorkerResult[],
  mergedReport: MergedReport,
): Map<string, string> {
  const findingToWorker = new Map<string, string>();

  for (const result of workerResults) {
    if (!result.report) continue;
    for (const finding of result.report.findings) {
      findingToWorker.set(finding.finding_id, result.workerId);
    }
  }

  return findingToWorker;
}

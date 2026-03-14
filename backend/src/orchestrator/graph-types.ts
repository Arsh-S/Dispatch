export type NodeId = string;
export type ClusterId = string;

export type RunStatus =
  | "idle"
  | "planning"
  | "executing"
  | "patching"
  | "retesting"
  | "completed";

export type NodeStatus =
  | "idle"
  | "queued"
  | "planning"
  | "running"
  | "warning"
  | "failed"
  | "success"
  | "fixer"
  | "retestVerified";

export type NodeType = "orchestrator" | "cluster" | "worker" | "finding";

export type EdgeKind =
  | "orchestrator"
  | "cluster"
  | "worker"
  | "finding"
  | "fixer"
  | "retest";

export type Severity = "low" | "medium" | "high" | "critical";

export interface GraphNode {
  id: NodeId;
  label: string;
  type: NodeType;
  clusterId?: ClusterId;
  status: NodeStatus;
  severity?: Severity;
  meta?: Record<string, unknown>;
  position?: { x: number; y: number };
  size?: number;
  activityLevel?: number;
}

export interface GraphEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  kind: EdgeKind;
  status?: NodeStatus;
}

export interface GraphCluster {
  id: ClusterId;
  label: string;
  type: string;
  status: NodeStatus;
}

export interface GraphData {
  nodes: Record<NodeId, GraphNode>;
  edges: GraphEdge[];
  clusters: Record<ClusterId, GraphCluster>;
}

export interface RunMetrics {
  routesDiscovered: number;
  workersActive: number;
  findingsFound: number;
  ticketsCreated: number;
  prsOpened: number;
  retestsPassed: number;
}

export type TriggeredBy = 'slack' | 'dashboard' | 'github' | 'api';

export interface DispatchOutput {
  dispatch_run_id: string;
  status: RunStatus;
  started_at: string;
  completed_at?: string;
  triggered_by?: TriggeredBy;
  repo: {
    name: string;
    url?: string;
  };
  pre_recon?: import('../schemas/pre-recon-deliverable').PreReconDeliverable;
  task_assignments: import('../schemas/task-assignment').TaskAssignment[];
  finding_reports: import('../schemas/finding-report').FindingReport[];
  findings: import('../schemas/finding-report').Finding[];
  metrics: RunMetrics;
  graph_data?: GraphData;
}

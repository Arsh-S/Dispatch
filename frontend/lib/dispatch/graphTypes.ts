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

export interface PlanPreviewItem {
  id: string;
  label: string;
  status?: string;
  timestamp?: string;
}

export interface RunMetrics {
  routesDiscovered: number;
  workersActive: number;
  findingsFound: number;
  ticketsCreated: number;
  prsOpened: number;
  retestsPassed: number;
}

export interface NodeEvent {
  id: string;
  timestamp: string;
  message: string;
  level?: "info" | "warn" | "error" | "success";
  meta?: Record<string, unknown>;
}

export interface RelatedAsset {
  id: string;
  type: "route" | "file" | "finding" | "ticket" | "pr" | "retest";
  label: string;
  href?: string;
}

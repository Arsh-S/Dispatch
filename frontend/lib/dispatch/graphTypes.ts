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

// Attack types from communication-schemas.md
export type AttackType =
  | "sql-injection"
  | "xss"
  | "command-injection"
  | "path-traversal"
  | "broken-auth"
  | "jwt-tampering"
  | "session-fixation"
  | "idor"
  | "secrets-exposure"
  | "misconfigured-cors"
  | "insecure-headers"
  | "open-debug"
  | "rate-limiting"
  | "prompt-injection"
  | "tool-poisoning"
  | "info-disclosure";

// Exploit confidence from Schema 2
export type ExploitConfidence = "confirmed" | "unconfirmed";

// Monkeypatch status from Schema 2
export type MonkeypatchStatus = "validated" | "failed" | "not-attempted";

// Fix status from github-issue-schema.md
export type FixStatus = "unfixed" | "in-progress" | "verified" | "unverified" | "failed";

// Worker execution status from Schema 2
export type WorkerExecutionStatus =
  | "completed"
  | "timeout"
  | "app_start_failed"
  | "app_crash"
  | "network_error"
  | "auth_failed"
  | "config_error"
  | "worker_error";

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

// ============================================================================
// Schema 0: Pre-Recon Deliverable (from communication-schemas.md)
// ============================================================================

export interface RouteMapEntry {
  endpoint: string;
  method: string;
  handler_file: string;
  handler_line: number;
  middleware: string[];
  parameters: Array<{
    name: string;
    source: "body" | "query" | "params" | "headers";
    type: string;
  }>;
}

export interface RiskSignal {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
  suggested_attack_types: AttackType[];
}

export interface DependencyGraph {
  db_layer: string;
  orm: string;
  auth_middleware: string;
  session_store: string;
}

export interface PreReconDeliverable {
  dispatch_run_id: string;
  completed_at: string;
  route_map: RouteMapEntry[];
  risk_signals: RiskSignal[];
  dependency_graph: DependencyGraph;
  briefing_notes: string;
}

// ============================================================================
// Schema 1: Task Assignment (from communication-schemas.md)
// ============================================================================

export interface TaskTarget {
  file: string;
  line_range?: [number, number];
  endpoint: string;
  method: string;
  parameters: string[];
}

export interface TaskContext {
  relevant_files: string[];
  api_keys?: Record<string, string>;
  rules_md?: string[];
  developer_notes?: string;
}

export interface AppConfig {
  runtime: string;
  install: string;
  start: string;
  port: number;
  seed?: string;
  env?: Record<string, string>;
}

export interface TaskAssignment {
  dispatch_run_id: string;
  worker_id: string;
  assigned_at: string;
  timeout_seconds: number;
  target: TaskTarget;
  attack_type: AttackType;
  context: TaskContext;
  app_config: AppConfig;
  briefing: string;
}

// ============================================================================
// Schema 2: Finding Report (from communication-schemas.md)
// ============================================================================

export interface ServerLogEntry {
  timestamp: string;
  level: "INFO" | "ERROR" | "WARN" | "DEBUG";
  message: string;
  source?: string;
  stack?: string;
}

export interface FindingLocation {
  file: string;
  line: number;
  endpoint: string;
  method: string;
  parameter: string | null;
}

export interface FindingReproduction {
  steps: string[];
  command: string;
  expected: string;
  actual: string;
}

export interface MonkeypatchValidation {
  test: string;
  result: "PASS" | "FAIL";
  response: string;
  side_effects: string;
}

export interface FindingMonkeypatch {
  status: MonkeypatchStatus;
  diff: string | null;
  validation: MonkeypatchValidation | null;
  post_patch_logs: ServerLogEntry[] | null;
}

export interface Finding {
  finding_id: string;
  severity: Uppercase<Severity>;
  cvss_score?: number;
  owasp?: string;
  vuln_type: AttackType | string;
  exploit_confidence: ExploitConfidence;
  location: FindingLocation;
  description: string;
  reproduction: FindingReproduction | null;
  server_logs: ServerLogEntry[];
  monkeypatch: FindingMonkeypatch;
  recommended_fix: string;
  rules_violated: string[];
  // Added fields for UI
  fix_status?: FixStatus;
  github_issue_url?: string;
  github_issue_number?: number;
  pr_url?: string;
  pr_number?: number;
}

export interface CleanEndpoint {
  endpoint: string;
  parameter: string;
  attack_type: AttackType;
  notes: string;
}

export interface WorkerErrorDetail {
  type: "environment" | "network" | "config" | "internal";
  code: string;
  message: string;
  retryable: boolean;
  phase: string;
  suggestion: string;
}

export interface FindingReport {
  dispatch_run_id: string;
  worker_id: string;
  completed_at: string;
  status: WorkerExecutionStatus;
  duration_seconds: number;
  error_detail: WorkerErrorDetail | null;
  findings: Finding[];
  clean_endpoints: CleanEndpoint[];
  worker_notes?: string;
}

// ============================================================================
// Schema 3 & 4: Construction Worker (from communication-schemas.md)
// ============================================================================

export interface ConstructionBootstrap {
  construction_worker_id: string;
  triggered_at: string;
  triggered_by: "slack" | "dashboard" | "github" | "api";
  timeout_seconds: number;
  github_issue: {
    repo: string;
    number: number;
  };
  app_config: AppConfig;
  pr_config: {
    base_branch: string;
    branch_prefix: string;
  };
}

export interface FixReport {
  construction_worker_id: string;
  completed_at: string;
  status: "fix_verified" | "fix_unverified" | "fix_failed" | "timeout" | "error";
  duration_seconds: number;
  github_issue: {
    repo: string;
    number: number;
  };
  pull_request?: {
    number: number;
    url: string;
    branch: string;
    files_changed: string[];
  };
  validation?: {
    result: "PASS" | "FAIL";
    response: string;
  };
}

// ============================================================================
// Dispatch Output (written by orchestrator, read by dashboard)
// ============================================================================

export interface DispatchOutput {
  dispatch_run_id: string;
  status: RunStatus;
  started_at: string;
  completed_at?: string;
  repo: {
    name: string;
    url?: string;
  };
  pre_recon?: PreReconDeliverable;
  task_assignments: TaskAssignment[];
  finding_reports: FindingReport[];
  findings: Finding[];
  metrics: RunMetrics;
  graph_data?: GraphData;
}

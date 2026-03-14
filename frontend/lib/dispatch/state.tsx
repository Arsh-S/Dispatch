"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  DispatchOutput,
  Finding,
  GraphData,
  GraphEdge,
  NodeId,
  PlanPreviewItem,
  PreReconDeliverable,
  RunMetrics,
  RunStatus,
  TaskAssignment,
  FindingReport,
} from "./graphTypes";

export interface OrchestratorSpec {
  repoName: string;
  repoUrl?: string;
  targetEnvironment: string;
  scanMode: "whitebox" | "graybox";
  frameworks: string[];
  integrations: string[];
  workerTypes: string[];
  priorities: string[];
}

export interface DispatchWorkspaceState {
  // Run identification
  dispatchRunId: string | null;
  runName: string;
  environment: string;
  runStatus: RunStatus;

  // Orchestrator
  orchestratorSpec: OrchestratorSpec | null;
  preRecon: PreReconDeliverable | null;
  planPreviewItems: PlanPreviewItem[];

  // Workers
  taskAssignments: TaskAssignment[];
  findingReports: FindingReport[];

  // Findings
  findings: Finding[];
  selectedFindingId: string | null;

  // Metrics & Graph
  metrics: RunMetrics;
  graphData: GraphData;

  // UI State
  selectedNodeId: NodeId | null;
  searchQuery: string;
  filters: GraphFilters;
  sidebarOpen: boolean;

  // Data loading
  isLoading: boolean;
  lastUpdated: string | null;
  error: string | null;
}

export interface GraphFilters {
  showCriticalPath: boolean;
  showFailedOnly: boolean;
  showFixerLoop: boolean;
  showReportingChain: boolean;
}

const defaultMetrics: RunMetrics = {
  routesDiscovered: 0,
  workersActive: 0,
  findingsFound: 0,
  ticketsCreated: 0,
  prsOpened: 0,
  retestsPassed: 0,
};

const defaultFilters: GraphFilters = {
  showCriticalPath: false,
  showFailedOnly: false,
  showFixerLoop: false,
  showReportingChain: false,
};

const defaultSpec: OrchestratorSpec = {
  repoName: "my-app",
  repoUrl: "https://github.com/org/my-app",
  targetEnvironment: "staging",
  scanMode: "whitebox",
  frameworks: ["Express", "React"],
  integrations: ["Datadog", "GitHub"],
  workerTypes: ["Auth", "Injection", "Config", "Fixer", "Retest"],
  priorities: ["auth", "injection", "secrets", "payments"],
};

type DispatchWorkspaceContextValue = DispatchWorkspaceState & {
  // Node selection
  selectNode: (id: NodeId | null) => void;
  // Finding selection
  selectFinding: (id: string | null) => void;
  getFindingById: (id: string) => Finding | undefined;
  // Search & filters
  setSearchQuery: (q: string) => void;
  setFilters: (f: Partial<GraphFilters>) => void;
  // Run state
  setRunStatus: (s: RunStatus) => void;
  setMetrics: (m: Partial<RunMetrics>) => void;
  setSidebarOpen: (open: boolean) => void;
  // Data loading
  loadDispatchOutput: (data: DispatchOutput) => void;
  refreshData: () => Promise<void>;
};

const DispatchWorkspaceContext =
  createContext<DispatchWorkspaceContextValue | null>(null);

export function DispatchWorkspaceProvider({ children }: { children: ReactNode }) {
  // Run identification
  const [dispatchRunId, setDispatchRunId] = useState<string | null>("dispatch-run-demo");
  const [runName, setRunName] = useState("Dispatch Demo Scan");
  const [environment, setEnvironment] = useState("staging");
  const [runStatus, setRunStatusState] = useState<RunStatus>("executing");

  // Orchestrator
  const [orchestratorSpec] = useState<OrchestratorSpec | null>(defaultSpec);
  const [preRecon, setPreRecon] = useState<PreReconDeliverable | null>(getMockPreRecon());
  const [planPreviewItems, setPlanPreviewItems] = useState<PlanPreviewItem[]>(
    getMockPlanPreviewItems()
  );

  // Workers
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([]);
  const [findingReports, setFindingReports] = useState<FindingReport[]>([]);

  // Findings
  const [findings, setFindings] = useState<Finding[]>(getMockFindings());
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Metrics & Graph
  const [metrics, setMetricsState] = useState<RunMetrics>(getMockMetrics());
  const [graphData, setGraphData] = useState<GraphData>(getMockGraphData());

  // UI State
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [searchQuery, setSearchQueryState] = useState("");
  const [filters, setFiltersState] = useState<GraphFilters>(defaultFilters);
  const [sidebarOpen, setSidebarOpenState] = useState(false);

  // Data loading
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(new Date().toISOString());
  const [error, setError] = useState<string | null>(null);

  const selectNode = useCallback((id: NodeId | null) => {
    setSelectedNodeId(id);
    setSidebarOpenState(!!id);
  }, []);

  const selectFinding = useCallback((id: string | null) => {
    setSelectedFindingId(id);
    setSidebarOpenState(!!id);
  }, []);

  const getFindingById = useCallback(
    (id: string) => findings.find((f) => f.finding_id === id),
    [findings]
  );

  const setSearchQuery = useCallback((q: string) => setSearchQueryState(q), []);
  const setRunStatus = useCallback((s: RunStatus) => setRunStatusState(s), []);
  const setSidebarOpen = useCallback((open: boolean) => setSidebarOpenState(open), []);

  const setMetrics = useCallback((m: Partial<RunMetrics>) => {
    setMetricsState((prev) => ({ ...prev, ...m }));
  }, []);

  const setFilters = useCallback((f: Partial<GraphFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  const loadDispatchOutput = useCallback((data: DispatchOutput) => {
    setDispatchRunId(data.dispatch_run_id);
    setRunStatusState(data.status);
    if (data.pre_recon) setPreRecon(data.pre_recon);
    setTaskAssignments(data.task_assignments);
    setFindingReports(data.finding_reports);
    setFindings(data.findings);
    setMetricsState(data.metrics);
    if (data.graph_data) setGraphData(data.graph_data);
    setLastUpdated(new Date().toISOString());
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/dispatch-output.json");
      if (response.ok) {
        const data: DispatchOutput = await response.json();
        loadDispatchOutput(data);
      }
    } catch (err) {
      // File doesn't exist or other error - this is expected during development
      console.debug("dispatch-output.json not found, using mock data");
    } finally {
      setIsLoading(false);
    }
  }, [loadDispatchOutput]);

  // Poll for updates every 2 seconds (as per implementation plan)
  useEffect(() => {
    const pollInterval = setInterval(refreshData, 2000);
    return () => clearInterval(pollInterval);
  }, [refreshData]);

  const value = useMemo<DispatchWorkspaceContextValue>(
    () => ({
      dispatchRunId,
      runName,
      environment,
      runStatus,
      orchestratorSpec,
      preRecon,
      planPreviewItems,
      taskAssignments,
      findingReports,
      findings,
      selectedFindingId,
      metrics,
      graphData,
      selectedNodeId,
      searchQuery,
      filters,
      sidebarOpen,
      isLoading,
      lastUpdated,
      error,
      selectNode,
      selectFinding,
      getFindingById,
      setSearchQuery,
      setFilters,
      setRunStatus,
      setMetrics,
      setSidebarOpen,
      loadDispatchOutput,
      refreshData,
    }),
    [
      dispatchRunId,
      runName,
      environment,
      runStatus,
      orchestratorSpec,
      preRecon,
      planPreviewItems,
      taskAssignments,
      findingReports,
      findings,
      selectedFindingId,
      metrics,
      graphData,
      selectedNodeId,
      searchQuery,
      filters,
      sidebarOpen,
      isLoading,
      lastUpdated,
      error,
      selectNode,
      selectFinding,
      getFindingById,
      setSearchQuery,
      setFilters,
      setRunStatus,
      setMetrics,
      setSidebarOpen,
      loadDispatchOutput,
      refreshData,
    ]
  );

  return (
    <DispatchWorkspaceContext.Provider value={value}>
      {children}
    </DispatchWorkspaceContext.Provider>
  );
}

export function useDispatchWorkspace(): DispatchWorkspaceContextValue {
  const ctx = useContext(DispatchWorkspaceContext);
  if (!ctx) throw new Error("useDispatchWorkspace must be used within DispatchWorkspaceProvider");
  return ctx;
}

// ============================================================================
// Mock Data Functions (matching communication-schemas.md)
// ============================================================================

function getMockPreRecon(): PreReconDeliverable {
  return {
    dispatch_run_id: "dispatch-run-demo",
    completed_at: new Date().toISOString(),
    route_map: [
      {
        endpoint: "POST /api/orders",
        method: "POST",
        handler_file: "src/routes/orders.js",
        handler_line: 40,
        middleware: ["auth", "rateLimit"],
        parameters: [
          { name: "order_id", source: "body", type: "string" },
          { name: "quantity", source: "body", type: "string" },
        ],
      },
      {
        endpoint: "GET /api/admin/users",
        method: "GET",
        handler_file: "src/routes/admin.js",
        handler_line: 12,
        middleware: [],
        parameters: [],
      },
      {
        endpoint: "POST /api/comments",
        method: "POST",
        handler_file: "src/routes/comments.js",
        handler_line: 25,
        middleware: ["auth"],
        parameters: [
          { name: "content", source: "body", type: "string" },
        ],
      },
      {
        endpoint: "GET /api/users/:id",
        method: "GET",
        handler_file: "src/routes/users.js",
        handler_line: 18,
        middleware: ["auth"],
        parameters: [
          { name: "id", source: "params", type: "string" },
        ],
      },
      {
        endpoint: "POST /api/login",
        method: "POST",
        handler_file: "src/routes/auth.js",
        handler_line: 8,
        middleware: [],
        parameters: [
          { name: "email", source: "body", type: "string" },
          { name: "password", source: "body", type: "string" },
        ],
      },
    ],
    risk_signals: [
      {
        file: "src/routes/orders.js",
        line: 47,
        pattern: "raw-sql-concatenation",
        snippet: "db.query(`SELECT * FROM orders WHERE id = '${req.body.order_id}'`)",
        suggested_attack_types: ["sql-injection"],
      },
      {
        file: "src/routes/admin.js",
        line: 12,
        pattern: "missing-auth-middleware",
        snippet: "router.get('/admin/users', async (req, res) => {",
        suggested_attack_types: ["broken-auth", "idor"],
      },
      {
        file: "src/routes/comments.js",
        line: 30,
        pattern: "reflected-input",
        snippet: "res.send(`<div>${req.body.content}</div>`)",
        suggested_attack_types: ["xss"],
      },
    ],
    dependency_graph: {
      db_layer: "src/db/connection.js",
      orm: "knex (used in users.js, products.js — NOT in orders.js)",
      auth_middleware: "src/middleware/auth.js",
      session_store: "express-session with MemoryStore",
    },
    briefing_notes:
      "The codebase is an Express app with 5 routes. Auth middleware exists but is not applied to /api/admin/*. The orders route uses raw SQL while the rest use knex. The session store is in-memory (MemoryStore), which is a known insecure default. JWT verification in auth.js does not check the algorithm field.",
  };
}

function getMockPlanPreviewItems(): PlanPreviewItem[] {
  return [
    { id: "1", label: "Mapped 5 routes", status: "completed", timestamp: new Date(Date.now() - 120000).toISOString() },
    { id: "2", label: "Found 3 risk signals", status: "completed", timestamp: new Date(Date.now() - 100000).toISOString() },
    { id: "3", label: "Built attack matrix (5 cells)", status: "completed", timestamp: new Date(Date.now() - 80000).toISOString() },
    { id: "4", label: "Dispatched Injection Worker", status: "completed", timestamp: new Date(Date.now() - 60000).toISOString() },
    { id: "5", label: "Dispatched Auth Worker", status: "completed", timestamp: new Date(Date.now() - 40000).toISOString() },
    { id: "6", label: "Collecting findings...", status: "in-progress", timestamp: new Date().toISOString() },
  ];
}

function getMockFindings(): Finding[] {
  return [
    {
      finding_id: "finding-sql-orders-001",
      severity: "HIGH",
      cvss_score: 8.1,
      owasp: "A03:2021",
      vuln_type: "sql-injection",
      exploit_confidence: "confirmed",
      location: {
        file: "src/routes/orders.js",
        line: 47,
        endpoint: "POST /api/orders",
        method: "POST",
        parameter: "order_id",
      },
      description:
        "The order_id parameter is interpolated directly into a SQL query via string concatenation on line 47. An attacker can inject arbitrary SQL to read, modify, or delete data in the orders table.",
      reproduction: {
        steps: [
          "Send POST /api/orders with a valid auth token",
          "Set order_id to: 1; DROP TABLE orders;--",
          "Observe 500 Internal Server Error with database error in response body",
        ],
        command:
          "curl -X POST http://localhost:3000/api/orders -H 'Content-Type: application/json' -H 'Authorization: Bearer eyJhbGciOi...' -d '{\"order_id\": \"1; DROP TABLE orders;--\"}'",
        expected: "400 Bad Request or parameterized query escapes the input",
        actual:
          "500 Internal Server Error — database error surfaced in response body, indicating raw SQL execution",
      },
      server_logs: [
        {
          timestamp: new Date(Date.now() - 30000).toISOString(),
          level: "INFO",
          message: "POST /api/orders — 200",
        },
        {
          timestamp: new Date(Date.now() - 29000).toISOString(),
          level: "ERROR",
          message: 'QueryFailedError: syntax error at or near "Drop"',
        },
        {
          timestamp: new Date(Date.now() - 28000).toISOString(),
          level: "ERROR",
          message: "Unhandled exception in POST /api/orders",
        },
      ],
      monkeypatch: {
        status: "validated",
        diff: `--- a/src/routes/orders.js
+++ b/src/routes/orders.js
@@ -45,3 +45,3 @@
-  const result = await db.query(\`SELECT * FROM orders WHERE id = '\${req.body.order_id}'\`);
+  const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.body.order_id]);`,
        validation: {
          test: "Replayed reproduction payload after applying monkeypatch",
          result: "PASS",
          response: "200 OK — returned empty result set",
          side_effects: "none",
        },
        post_patch_logs: [
          {
            timestamp: new Date(Date.now() - 20000).toISOString(),
            level: "INFO",
            message: "POST /api/orders — 200",
          },
        ],
      },
      recommended_fix:
        "The monkeypatch hardcodes a parameterized query as a direct replacement. The codebase uses knex in src/routes/users.js:23 — the construction worker should refactor to use the existing knex query builder instead of raw SQL. Also check src/routes/products.js:61 which has the same concatenation pattern.",
      rules_violated: [
        "No raw SQL queries — must use parameterized statements",
        "Payment endpoints are critical priority",
      ],
      fix_status: "unfixed",
      github_issue_number: 42,
      github_issue_url: "https://github.com/org/repo/issues/42",
    },
    {
      finding_id: "finding-auth-admin-002",
      severity: "CRITICAL",
      cvss_score: 9.1,
      owasp: "A01:2021",
      vuln_type: "broken-auth",
      exploit_confidence: "confirmed",
      location: {
        file: "src/routes/admin.js",
        line: 12,
        endpoint: "GET /api/admin/users",
        method: "GET",
        parameter: null,
      },
      description:
        "The /api/admin/users endpoint has no authentication middleware. Any unauthenticated user can retrieve the full list of users including their email addresses and hashed passwords.",
      reproduction: {
        steps: [
          "Send GET /api/admin/users without any authorization header",
          "Observe 200 OK with full user list in response body",
        ],
        command: "curl http://localhost:3000/api/admin/users",
        expected: "401 Unauthorized",
        actual: "200 OK — full user list returned including emails and password hashes",
      },
      server_logs: [
        {
          timestamp: new Date(Date.now() - 25000).toISOString(),
          level: "INFO",
          message: "GET /api/admin/users — 200 — no auth header",
        },
      ],
      monkeypatch: {
        status: "validated",
        diff: `--- a/src/routes/admin.js
+++ b/src/routes/admin.js
@@ -10,3 +10,3 @@
-router.get('/admin/users', async (req, res) => {
+router.get('/admin/users', authMiddleware, async (req, res) => {`,
        validation: {
          test: "Replayed unauthenticated request after adding auth middleware",
          result: "PASS",
          response: "401 Unauthorized",
          side_effects: "none",
        },
        post_patch_logs: [
          {
            timestamp: new Date(Date.now() - 15000).toISOString(),
            level: "INFO",
            message: "GET /api/admin/users — 401 — missing auth",
          },
        ],
      },
      recommended_fix:
        "Add the authMiddleware to the route handler. The middleware already exists at src/middleware/auth.js and is used by other admin routes. Import it and add it as the second argument to router.get().",
      rules_violated: ["All API endpoints must require authentication"],
      fix_status: "unfixed",
      github_issue_number: 43,
      github_issue_url: "https://github.com/org/repo/issues/43",
    },
    {
      finding_id: "finding-xss-comments-003",
      severity: "MEDIUM",
      cvss_score: 5.4,
      owasp: "A03:2021",
      vuln_type: "xss",
      exploit_confidence: "confirmed",
      location: {
        file: "src/routes/comments.js",
        line: 30,
        endpoint: "POST /api/comments",
        method: "POST",
        parameter: "content",
      },
      description:
        "The content parameter is reflected directly into the HTML response without sanitization. An attacker can inject JavaScript that will execute in other users' browsers.",
      reproduction: {
        steps: [
          "Send POST /api/comments with a valid auth token",
          "Set content to: <script>alert('XSS')</script>",
          "Observe the script tag is returned verbatim in the response",
        ],
        command:
          "curl -X POST http://localhost:3000/api/comments -H 'Content-Type: application/json' -H 'Authorization: Bearer ...' -d '{\"content\": \"<script>alert(1)</script>\"}'",
        expected: "HTML entities escaped or content rejected",
        actual: "Script tag returned unescaped in response body",
      },
      server_logs: [],
      monkeypatch: {
        status: "not-attempted",
        diff: null,
        validation: null,
        post_patch_logs: null,
      },
      recommended_fix:
        "Use a library like DOMPurify or escape-html to sanitize user input before reflecting it in the response. Alternatively, use a templating engine with auto-escaping enabled.",
      rules_violated: [],
      fix_status: "unfixed",
    },
    {
      finding_id: "finding-info-disclosure-004",
      severity: "LOW",
      cvss_score: 3.7,
      owasp: "A04:2021",
      vuln_type: "info-disclosure",
      exploit_confidence: "unconfirmed",
      location: {
        file: "src/routes/orders.js",
        line: 80,
        endpoint: "POST /api/orders",
        method: "POST",
        parameter: null,
      },
      description:
        "The error handler on line 80 appears to return raw database error messages to the client. During SQL injection testing, the 500 response included a QueryFailedError stack trace. However, this was observed as a side effect of the injection test — the information disclosure was not independently triggered or verified.",
      reproduction: null,
      server_logs: [],
      monkeypatch: {
        status: "not-attempted",
        diff: null,
        validation: null,
        post_patch_logs: null,
      },
      recommended_fix:
        "The error handler should catch database errors and return a generic 500 response without exposing internal error details. Consider a centralized error handling middleware.",
      rules_violated: [],
      fix_status: "unfixed",
    },
  ];
}

function getMockMetrics(): RunMetrics {
  return {
    routesDiscovered: 5,
    workersActive: 2,
    findingsFound: 4,
    ticketsCreated: 2,
    prsOpened: 0,
    retestsPassed: 0,
  };
}

function getMockGraphData(): GraphData {
  const orchestratorId = "orchestrator";
  const clusters = ["auth", "injection", "config", "fixer", "retest", "reporting"] as const;
  const nodes: GraphData["nodes"] = {
    [orchestratorId]: {
      id: orchestratorId,
      label: "Orchestrator",
      type: "orchestrator",
      status: "running",
      position: { x: 400, y: 300 },
      size: 48,
    },
  };
  const edges: GraphEdge[] = [];
  const clusterRecords: GraphData["clusters"] = {} as GraphData["clusters"];

  const positions: Record<string, { x: number; y: number }> = {
    auth: { x: 180, y: 120 },
    injection: { x: 620, y: 120 },
    config: { x: 180, y: 480 },
    fixer: { x: 620, y: 480 },
    retest: { x: 320, y: 520 },
    reporting: { x: 480, y: 520 },
  };

  const clusterStatuses: Record<string, "idle" | "running" | "success"> = {
    auth: "success",
    injection: "running",
    config: "idle",
    fixer: "idle",
    retest: "idle",
    reporting: "idle",
  };

  clusters.forEach((clusterId, i) => {
    const pos = positions[clusterId] ?? { x: 300 + i * 80, y: 200 };
    const status = clusterStatuses[clusterId] || "idle";
    clusterRecords[clusterId] = {
      id: clusterId,
      label: `${clusterId.charAt(0).toUpperCase() + clusterId.slice(1)} Workers`,
      type: "cluster",
      status,
    };
    nodes[clusterId] = {
      id: clusterId,
      label: clusterRecords[clusterId].label,
      type: "cluster",
      clusterId,
      status,
      position: pos,
      size: 28,
    };
    edges.push({
      id: `e-${orchestratorId}-${clusterId}`,
      from: orchestratorId,
      to: clusterId,
      kind: "orchestrator",
    });
    [1, 2].forEach((j) => {
      const wid = `${clusterId}-w${j}`;
      const angle = (j / 2) * Math.PI * 0.5 + i * 0.3;
      const r = 60;
      const workerStatus =
        clusterId === "auth"
          ? "success"
          : clusterId === "injection" && j === 1
          ? "running"
          : "idle";
      nodes[wid] = {
        id: wid,
        label: `${clusterId} Worker ${j}`,
        type: "worker",
        clusterId,
        status: workerStatus,
        position: {
          x: pos.x + Math.cos(angle) * r,
          y: pos.y + Math.sin(angle) * r,
        },
        size: 14,
      };
      edges.push({ id: `e-${clusterId}-${wid}`, from: clusterId, to: wid, kind: "worker" });
    });
  });

  // Add finding nodes
  const findingPositions = [
    { x: 750, y: 200 },
    { x: 750, y: 280 },
    { x: 750, y: 360 },
    { x: 750, y: 440 },
  ];
  const findings = getMockFindings();
  findings.forEach((finding, i) => {
    const nodeId = finding.finding_id;
    nodes[nodeId] = {
      id: nodeId,
      label: `${finding.vuln_type}: ${finding.location.endpoint}`,
      type: "finding",
      status: finding.exploit_confidence === "confirmed" ? "failed" : "warning",
      severity: finding.severity.toLowerCase() as "low" | "medium" | "high" | "critical",
      position: findingPositions[i] || { x: 750, y: 200 + i * 80 },
      size: 18,
      meta: { finding },
    };
    // Connect finding to injection cluster
    edges.push({
      id: `e-injection-${nodeId}`,
      from: "injection",
      to: nodeId,
      kind: "finding",
    });
  });

  return { nodes, edges, clusters: clusterRecords };
}

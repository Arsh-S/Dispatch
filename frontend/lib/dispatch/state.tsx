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
  AgentDiagnostics,
  DispatchOutput,
  Finding,
  GraphData,
  HealthStatus,
  NodeId,
  PreReconDeliverable,
  RunMetrics,
  RunStatus,
  TaskAssignment,
  FindingReport,
} from "./graphTypes";

/** @deprecated - Left for backward compat with unused components */
export interface GraphFilters {
  showCriticalPath: boolean;
  showFailedOnly: boolean;
  showFixerLoop: boolean;
  showReportingChain: boolean;
}

/** @deprecated - Left for backward compat with unused components */
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
  dispatchRunId: string | null;
  runStatus: RunStatus;
  runName: string;
  environment: string;

  preRecon: PreReconDeliverable | null;
  taskAssignments: TaskAssignment[];
  findingReports: FindingReport[];
  findings: Finding[];

  metrics: RunMetrics;
  graphData: GraphData;
  workerDiagnostics: Record<string, AgentDiagnostics>;

  selectedNodeId: NodeId | null;
  sidebarOpen: boolean;

  isLoading: boolean;
  lastUpdated: string | null;
  error: string | null;
}

const emptyMetrics: RunMetrics = {
  routesDiscovered: 0,
  workersActive: 0,
  findingsFound: 0,
  ticketsCreated: 0,
  prsOpened: 0,
  retestsPassed: 0,
};

const emptyGraphData: GraphData = { nodes: {}, edges: [], clusters: {} };

type DispatchWorkspaceContextValue = DispatchWorkspaceState & {
  selectNode: (id: NodeId | null) => void;
  selectFinding: (id: string | null) => void;
  getFindingById: (id: string) => Finding | undefined;
  getAssignmentByWorkerId: (workerId: string) => TaskAssignment | undefined;
  getReportByWorkerId: (workerId: string) => FindingReport | undefined;
  getDiagnosticsByWorkerId: (workerId: string) => AgentDiagnostics | undefined;
  getWorkerHealthStatus: (workerId: string) => HealthStatus;
  setSidebarOpen: (open: boolean) => void;
  setRunStatus: (status: RunStatus) => void;
  loadDispatchOutput: (data: DispatchOutput) => void;
  refreshData: () => Promise<void>;
};

const DispatchWorkspaceContext =
  createContext<DispatchWorkspaceContextValue | null>(null);

export function DispatchWorkspaceProvider({ children }: { children: ReactNode }) {
  const [dispatchRunId, setDispatchRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runName, setRunName] = useState<string>("");
  const [environment] = useState<string>("staging");

  const [preRecon, setPreRecon] = useState<PreReconDeliverable | null>(null);
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([]);
  const [findingReports, setFindingReports] = useState<FindingReport[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);

  const [metrics, setMetrics] = useState<RunMetrics>(emptyMetrics);
  const [graphData, setGraphData] = useState<GraphData>(emptyGraphData);
  const [workerDiagnostics, setWorkerDiagnostics] = useState<Record<string, AgentDiagnostics>>({});

  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [sidebarOpen, setSidebarOpenState] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectNode = useCallback((id: NodeId | null) => {
    setSelectedNodeId(id);
    setSidebarOpenState(!!id);
  }, []);

  const selectFinding = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    setSidebarOpenState(!!id);
  }, []);

  const getFindingById = useCallback(
    (id: string) => findings.find((f) => f.finding_id === id),
    [findings]
  );

  const getAssignmentByWorkerId = useCallback(
    (workerId: string) => taskAssignments.find((a) => a.worker_id === workerId),
    [taskAssignments]
  );

  const getReportByWorkerId = useCallback(
    (workerId: string) => findingReports.find((r) => r.worker_id === workerId),
    [findingReports]
  );

  const getDiagnosticsByWorkerId = useCallback(
    (workerId: string) => workerDiagnostics[workerId],
    [workerDiagnostics]
  );

  const getWorkerHealthStatus = useCallback(
    (workerId: string): HealthStatus => {
      const diag = workerDiagnostics[workerId];
      if (!diag) return 'healthy';

      // Client-side heuristic mirroring backend LoopDetector
      const MAX_TRACE = 200;
      const MAX_WALL = 600;
      const MAX_CONSECUTIVE_ERRORS = 5;
      const MAX_REPETITION_RATIO = 0.4;

      if (diag.trace_length > MAX_TRACE) return 'looping';
      if (diag.wall_clock_seconds > MAX_WALL) return 'looping';
      if (diag.consecutive_errors >= MAX_CONSECUTIVE_ERRORS) return 'looping';
      if (diag.total_tool_calls > 10) {
        const ratio = diag.repeated_calls / diag.total_tool_calls;
        if (ratio > MAX_REPETITION_RATIO) return 'looping';
      }

      // Warning thresholds (70%)
      if (diag.trace_length / MAX_TRACE > 0.7) return 'warning';
      if (diag.wall_clock_seconds / MAX_WALL > 0.7) return 'warning';
      if (diag.consecutive_errors / MAX_CONSECUTIVE_ERRORS > 0.6) return 'warning';

      return 'healthy';
    },
    [workerDiagnostics]
  );

  const setSidebarOpen = useCallback((open: boolean) => setSidebarOpenState(open), []);

  const setRunStatusFn = useCallback((status: RunStatus) => setRunStatus(status), []);

  const loadDispatchOutput = useCallback((data: DispatchOutput) => {
    setDispatchRunId(data.dispatch_run_id);
    setRunStatus(data.status);
    setRunName(data.repo?.name ?? "Dispatch Run");
    if (data.pre_recon) setPreRecon(data.pre_recon);
    setTaskAssignments(data.task_assignments);
    setFindingReports(data.finding_reports);
    setFindings(data.findings);
    setMetrics(data.metrics);
    if (data.graph_data) setGraphData(data.graph_data);
    if (data.worker_diagnostics) setWorkerDiagnostics(data.worker_diagnostics);
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
    } catch {
      console.debug("dispatch-output.json not found");
    } finally {
      setIsLoading(false);
    }
  }, [loadDispatchOutput]);

  useEffect(() => {
    refreshData();
    const pollInterval = setInterval(refreshData, 2000);
    return () => clearInterval(pollInterval);
  }, [refreshData]);

  const value = useMemo<DispatchWorkspaceContextValue>(
    () => ({
      dispatchRunId,
      runStatus,
      runName,
      environment,
      preRecon,
      taskAssignments,
      findingReports,
      findings,
      metrics,
      graphData,
      workerDiagnostics,
      selectedNodeId,
      sidebarOpen,
      isLoading,
      lastUpdated,
      error,
      selectNode,
      selectFinding,
      getFindingById,
      getAssignmentByWorkerId,
      getReportByWorkerId,
      getDiagnosticsByWorkerId,
      getWorkerHealthStatus,
      setSidebarOpen,
      setRunStatus: setRunStatusFn,
      loadDispatchOutput,
      refreshData,
    }),
    [
      dispatchRunId,
      runStatus,
      runName,
      environment,
      preRecon,
      taskAssignments,
      findingReports,
      findings,
      metrics,
      graphData,
      workerDiagnostics,
      selectedNodeId,
      sidebarOpen,
      isLoading,
      lastUpdated,
      error,
      selectNode,
      selectFinding,
      getFindingById,
      getAssignmentByWorkerId,
      getReportByWorkerId,
      getDiagnosticsByWorkerId,
      getWorkerHealthStatus,
      setSidebarOpen,
      setRunStatusFn,
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

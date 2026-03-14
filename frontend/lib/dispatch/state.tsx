"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  GraphData,
  GraphEdge,
  NodeId,
  PlanPreviewItem,
  RunMetrics,
  RunStatus,
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
  runName: string;
  environment: string;
  runStatus: RunStatus;
  orchestratorSpec: OrchestratorSpec | null;
  planPreviewItems: PlanPreviewItem[];
  metrics: RunMetrics;
  graphData: GraphData;
  selectedNodeId: NodeId | null;
  searchQuery: string;
  filters: GraphFilters;
  sidebarOpen: boolean;
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
  selectNode: (id: NodeId | null) => void;
  setSearchQuery: (q: string) => void;
  setFilters: (f: Partial<GraphFilters>) => void;
  setRunStatus: (s: RunStatus) => void;
  setMetrics: (m: Partial<RunMetrics>) => void;
  setSidebarOpen: (open: boolean) => void;
};

const DispatchWorkspaceContext =
  createContext<DispatchWorkspaceContextValue | null>(null);

export function DispatchWorkspaceProvider({ children }: { children: ReactNode }) {
  const [runName, setRunName] = useState("Default run");
  const [environment, setEnvironment] = useState("staging");
  const [runStatus, setRunStatusState] = useState<RunStatus>("idle");
  const [orchestratorSpec] = useState<OrchestratorSpec | null>(defaultSpec);
  const [planPreviewItems, setPlanPreviewItems] = useState<PlanPreviewItem[]>([
    { id: "1", label: "Mapped 18 routes" },
    { id: "2", label: "Found 3 auth middleware gaps" },
    { id: "3", label: "Prioritized /payments, /admin, /orders/:id" },
    { id: "4", label: "Queued Auth Worker cluster" },
    { id: "5", label: "Queued Injection Worker cluster" },
  ]);
  const [metrics, setMetricsState] = useState<RunMetrics>(defaultMetrics);
  const [graphData, setGraphData] = useState<GraphData>(getMockGraphData());
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [searchQuery, setSearchQueryState] = useState("");
  const [filters, setFiltersState] = useState<GraphFilters>(defaultFilters);
  const [sidebarOpen, setSidebarOpenState] = useState(false);

  const selectNode = useCallback((id: NodeId | null) => {
    setSelectedNodeId(id);
    setSidebarOpenState(!!id);
  }, []);

  const setSearchQuery = useCallback((q: string) => setSearchQueryState(q), []);
  const setRunStatus = useCallback((s: RunStatus) => setRunStatusState(s), []);
  const setSidebarOpen = useCallback((open: boolean) => setSidebarOpenState(open), []);

  const setMetrics = useCallback((m: Partial<RunMetrics>) => {
    setMetricsState((prev) => ({ ...prev, ...m }));
  }, []);

  const setFilters = useCallback((f: Partial<GraphFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  const value = useMemo<DispatchWorkspaceContextValue>(
    () => ({
      runName,
      environment,
      runStatus,
      orchestratorSpec,
      planPreviewItems,
      metrics,
      graphData,
      selectedNodeId,
      searchQuery,
      filters,
      sidebarOpen,
      selectNode,
      setSearchQuery,
      setFilters,
      setRunStatus,
      setMetrics,
      setSidebarOpen,
    }),
    [
      runName,
      environment,
      runStatus,
      orchestratorSpec,
      planPreviewItems,
      metrics,
      graphData,
      selectedNodeId,
      searchQuery,
      filters,
      sidebarOpen,
      selectNode,
      setSearchQuery,
      setFilters,
      setRunStatus,
      setMetrics,
      setSidebarOpen,
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

function getMockGraphData(): GraphData {
  const orchestratorId = "orchestrator";
  const clusters = ["auth", "injection", "config", "fixer", "retest", "reporting"] as const;
  const nodes: GraphData["nodes"] = {
    [orchestratorId]: {
      id: orchestratorId,
      label: "Orchestrator",
      type: "orchestrator",
      status: "planning",
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

  clusters.forEach((clusterId, i) => {
    const pos = positions[clusterId] ?? { x: 300 + i * 80, y: 200 };
    clusterRecords[clusterId] = {
      id: clusterId,
      label: `${clusterId.charAt(0).toUpperCase() + clusterId.slice(1)} Workers`,
      type: "cluster",
      status: "idle",
    };
    nodes[clusterId] = {
      id: clusterId,
      label: clusterRecords[clusterId].label,
      type: "cluster",
      clusterId,
      status: "idle",
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
      nodes[wid] = {
        id: wid,
        label: `${clusterId} Worker ${j}`,
        type: "worker",
        clusterId,
        status: j === 1 && clusterId === "auth" ? "running" : "idle",
        position: {
          x: pos.x + Math.cos(angle) * r,
          y: pos.y + Math.sin(angle) * r,
        },
        size: 14,
      };
      edges.push({ id: `e-${clusterId}-${wid}`, from: clusterId, to: wid, kind: "worker" });
    });
  });

  return { nodes, edges, clusters: clusterRecords };
}

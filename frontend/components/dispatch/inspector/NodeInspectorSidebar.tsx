"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X, MousePointerClick } from "lucide-react";
import { NodeHeader } from "./NodeHeader";
import { FindingDetailsCard } from "./FindingDetailsCard";
import { OrchestratorInspector } from "./OrchestratorInspector";
import { WorkerInspector } from "./WorkerInspector";
import { ClusterInspector } from "./ClusterInspector";
import type { Finding } from "@/lib/dispatch/graphTypes";

export function NodeInspectorSidebar() {
  const {
    selectedNodeId,
    graphData,
    selectNode,
    preRecon,
    taskAssignments,
    findingReports,
    getFindingById,
    getAssignmentByWorkerId,
    getReportByWorkerId,
    getDiagnosticsByWorkerId,
    getWorkerHealthStatus,
  } = useDispatchWorkspace();

  if (selectedNodeId == null) {
    return (
      <aside className="flex w-80 shrink-0 flex-col bg-card/50">
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <MousePointerClick className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Click a node to inspect
            </p>
          </div>
        </ScrollArea>
      </aside>
    );
  }

  const node = graphData.nodes[selectedNodeId];
  if (!node) {
    return (
      <aside className="flex w-56 shrink-0 flex-col border-l border-border bg-card/50 p-3">
        <p className="text-xs text-muted-foreground">Node not found</p>
      </aside>
    );
  }

  const clusterLabel = node.clusterId
    ? graphData.clusters[node.clusterId]?.label
    : undefined;

  const finding: Finding | undefined =
    node.type === "finding"
      ? (node.meta?.finding as Finding) || getFindingById(node.id)
      : undefined;

  function renderNodeContent() {
    switch (node.type) {
      case "orchestrator":
        return <OrchestratorInspector preRecon={preRecon} taskAssignments={taskAssignments} />;

      case "worker": {
        const assignment = (node.meta?.assignment as ReturnType<typeof getAssignmentByWorkerId>) || getAssignmentByWorkerId(node.id);
        const report = (node.meta?.report as ReturnType<typeof getReportByWorkerId>) || getReportByWorkerId(node.id);
        const diagnostics = getDiagnosticsByWorkerId(node.id);
        const healthStatus = getWorkerHealthStatus(node.id);
        return <WorkerInspector assignment={assignment} report={report} diagnostics={diagnostics} healthStatus={healthStatus} />;
      }

      case "cluster": {
        const clusterWorkerIds = Object.values(graphData.nodes)
          .filter((n) => n.type === "worker" && n.clusterId === node.clusterId)
          .map((n) => n.id);
        const clusterAssignments = taskAssignments.filter((a) =>
          clusterWorkerIds.includes(a.worker_id)
        );
        return (
          <ClusterInspector
            clusterId={node.clusterId || node.id}
            assignments={clusterAssignments}
            graphNodes={graphData.nodes}
          />
        );
      }

      case "finding":
        return finding ? <FindingDetailsCard finding={finding} /> : <p className="text-xs text-muted-foreground">No finding data</p>;

      default:
        return <p className="text-xs text-muted-foreground">Unknown node type</p>;
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card/50">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Inspector</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => selectNode(null)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <NodeHeader
            name={node.label}
            type={node.type}
            state={node.status}
            clusterLabel={clusterLabel}
          />
          {renderNodeContent()}
        </div>
      </ScrollArea>
    </aside>
  );
}

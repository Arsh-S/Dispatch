"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { EmptyInspectorState } from "./EmptyInspectorState";
import { NodeStatusLegend } from "./NodeStatusLegend";
import { NodeHeader } from "./NodeHeader";
import { NodeSummaryCard } from "./NodeSummaryCard";
import { NodeActivityFeed } from "./NodeActivityFeed";
import { RelatedAssetsPanel } from "./RelatedAssetsPanel";
import { NodeActionsPanel } from "./NodeActionsPanel";
import { FindingDetailsCard } from "./FindingDetailsCard";

const mockEvents = [
  { id: "1", timestamp: "12:00:01", message: "Parsed /orders/:id", level: "info" as const },
  { id: "2", timestamp: "12:00:02", message: "Identified string-concatenated query", level: "info" as const },
  { id: "3", timestamp: "12:00:03", message: "Attempted payload set A", level: "info" as const },
  { id: "4", timestamp: "12:00:04", message: "Returned 500", level: "warn" as const },
  { id: "5", timestamp: "12:00:05", message: "Confirmed injectable parameter", level: "error" as const },
  { id: "6", timestamp: "12:00:06", message: "Escalated to orchestrator", level: "info" as const },
];

const mockAssets = [
  { id: "r1", type: "route" as const, label: "/orders/:id" },
  { id: "f1", type: "file" as const, label: "src/routes/orders.ts" },
];

export function NodeInspectorSidebar() {
  const { selectedNodeId, graphData, selectNode } = useDispatchWorkspace();

  if (selectedNodeId == null) {
    return (
      <div className="flex w-52 flex-shrink-0 flex-col border-l border-dispatch-muted bg-dispatch-slate/30 py-4">
        <div className="px-4">
          <EmptyInspectorState />
          <NodeStatusLegend />
        </div>
      </div>
    );
  }

  const node = graphData.nodes[selectedNodeId];
  if (!node) {
    return (
      <div className="w-[22%] min-w-[240px] flex-shrink-0 border-l border-dispatch-muted bg-dispatch-slate/30 p-4">
        <EmptyInspectorState />
      </div>
    );
  }

  const clusterLabel = node.clusterId
    ? graphData.clusters[node.clusterId]?.label
    : undefined;

  return (
    <div className="w-[22%] min-w-[260px] flex-shrink-0 flex flex-col border-l border-dispatch-muted bg-dispatch-slate/30 overflow-y-auto">
      <div className="sticky top-0 flex justify-end border-b border-dispatch-muted bg-dispatch-slate/50 px-2 py-1">
        <button
          type="button"
          onClick={() => selectNode(null)}
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-dispatch-muted hover:text-slate-300"
        >
          Close
        </button>
      </div>
      <div className="space-y-4 p-4">
        <NodeHeader
          name={node.label}
          type={node.type}
          state={node.status}
          duration="12s"
          clusterLabel={clusterLabel}
        />
        <NodeSummaryCard
          currentTask="Scan /orders/:id for injection"
          assignedTarget="/orders/:id"
          status={node.status}
          lastUpdate="Just now"
          severity={node.severity}
        />
        {node.type === "finding" && node.severity && (
          <FindingDetailsCard
            severity={node.severity}
            endpoint="/orders/:id"
            filePath="src/routes/orders.ts"
            lineNumber={42}
            exploitSummary="SQLi via orderId param"
            remediation="Use parameterized query"
          />
        )}
        <NodeActivityFeed events={mockEvents} />
        <RelatedAssetsPanel assets={mockAssets} />
        <NodeActionsPanel
          onRerun={() => {}}
          onCreateTicket={() => {}}
          onJumpToCode={() => {}}
        />
      </div>
    </div>
  );
}

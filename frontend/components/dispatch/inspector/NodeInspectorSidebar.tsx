"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
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
      <aside className="flex w-56 shrink-0 flex-col border-l border-border bg-card/50">
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            <EmptyInspectorState />
            <NodeStatusLegend />
          </div>
        </ScrollArea>
      </aside>
    );
  }

  const node = graphData.nodes[selectedNodeId];
  if (!node) {
    return (
      <aside className="flex w-64 shrink-0 flex-col border-l border-border bg-card/50 p-3">
        <EmptyInspectorState />
      </aside>
    );
  }

  const clusterLabel = node.clusterId
    ? graphData.clusters[node.clusterId]?.label
    : undefined;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card/50">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Inspector</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => selectNode(null)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">
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
      </ScrollArea>
    </aside>
  );
}

"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { EmptyInspectorState } from "./EmptyInspectorState";
import { NodeStatusLegend } from "./NodeStatusLegend";
import { NodeHeader } from "./NodeHeader";
import { NodeSummaryCard } from "./NodeSummaryCard";
import { NodeActivityFeed } from "./NodeActivityFeed";
import { RelatedAssetsPanel } from "./RelatedAssetsPanel";
import { NodeActionsPanel } from "./NodeActionsPanel";
import { FindingDetailsCard } from "./FindingDetailsCard";
import type { Finding, NodeEvent, RelatedAsset } from "@/lib/dispatch/graphTypes";

export function NodeInspectorSidebar() {
  const { selectedNodeId, graphData, selectNode, findings, getFindingById } = useDispatchWorkspace();

  if (selectedNodeId == null) {
    return (
      <aside className="flex w-80 shrink-0 flex-col bg-card/50">
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
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
      <aside className="flex w-80 shrink-0 flex-col bg-card/50 p-4">
        <EmptyInspectorState />
      </aside>
    );
  }

  const clusterLabel = node.clusterId
    ? graphData.clusters[node.clusterId]?.label
    : undefined;

  // Get finding if this is a finding node
  const finding: Finding | undefined =
    node.type === "finding"
      ? (node.meta?.finding as Finding) || getFindingById(node.id)
      : undefined;

  // Generate events from finding server logs or use mock events
  const events: NodeEvent[] = finding?.server_logs?.map((log, i) => ({
    id: `log-${i}`,
    timestamp: new Date(log.timestamp).toLocaleTimeString(),
    message: log.message,
    level: log.level === "ERROR" ? "error" : log.level === "WARN" ? "warn" : "info",
  })) || getDefaultEvents(node.type, node.status);

  // Generate related assets from finding
  const assets: RelatedAsset[] = finding
    ? [
        { id: "route", type: "route" as const, label: finding.location.endpoint },
        { id: "file", type: "file" as const, label: `${finding.location.file}:${finding.location.line}` },
        ...(finding.github_issue_url
          ? [{ id: "ticket", type: "ticket" as const, label: `Issue #${finding.github_issue_number}`, href: finding.github_issue_url }]
          : []),
        ...(finding.pr_url
          ? [{ id: "pr", type: "pr" as const, label: `PR #${finding.pr_number}`, href: finding.pr_url }]
          : []),
      ]
    : getDefaultAssets(node.type);

  // Get summary info
  const currentTask = finding
    ? `Found ${finding.vuln_type.replace(/-/g, " ")} vulnerability`
    : node.type === "orchestrator"
    ? "Coordinating scan execution"
    : node.type === "cluster"
    ? `Managing ${node.label}`
    : `Scanning for vulnerabilities`;

  const assignedTarget = finding?.location.endpoint || getDefaultTarget(node.type, node.label);

  const lastUpdate = finding?.server_logs?.[0]?.timestamp
    ? formatRelativeTime(finding.server_logs[0].timestamp)
    : "Just now";

  return (
    <aside className="flex w-80 shrink-0 flex-col bg-card/50">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Inspector</span>
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
            duration={finding ? `${formatDuration(finding.server_logs)}` : "—"}
            clusterLabel={clusterLabel}
          />

          {/* Show full finding details if this is a finding node */}
          {finding ? (
            <FindingDetailsCard finding={finding} />
          ) : (
            <>
              <NodeSummaryCard
                currentTask={currentTask}
                assignedTarget={assignedTarget}
                status={node.status}
                lastUpdate={lastUpdate}
                severity={node.severity}
              />
              <NodeActivityFeed events={events} />
              <RelatedAssetsPanel assets={assets} />
            </>
          )}

          <NodeActionsPanel
            finding={finding}
            onRerun={() => console.log("Rerun triggered")}
            onCreateTicket={() => finding?.github_issue_url && window.open(finding.github_issue_url, "_blank")}
            onJumpToCode={() => console.log("Jump to code:", finding?.location.file)}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

// Helper functions
function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatDuration(logs: { timestamp: string }[] | undefined): string {
  if (!logs || logs.length < 2) return "—";
  const first = new Date(logs[logs.length - 1].timestamp).getTime();
  const last = new Date(logs[0].timestamp).getTime();
  const diff = Math.abs(last - first);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function getDefaultEvents(nodeType: string, status: string): NodeEvent[] {
  if (nodeType === "orchestrator") {
    return [
      { id: "1", timestamp: "—", message: "Pre-recon phase started", level: "info" },
      { id: "2", timestamp: "—", message: "Codebase analysis complete", level: "info" },
      { id: "3", timestamp: "—", message: "Attack matrix built", level: "info" },
      { id: "4", timestamp: "—", message: "Dispatching workers", level: "info" },
    ];
  }
  if (nodeType === "cluster") {
    return [
      { id: "1", timestamp: "—", message: "Cluster initialized", level: "info" },
      { id: "2", timestamp: "—", message: "Workers assigned", level: "info" },
    ];
  }
  return [
    { id: "1", timestamp: "—", message: "Worker started", level: "info" },
    { id: "2", timestamp: "—", message: `Status: ${status}`, level: "info" },
  ];
}

function getDefaultAssets(nodeType: string): RelatedAsset[] {
  if (nodeType === "orchestrator") {
    return [
      { id: "1", type: "route", label: "5 routes mapped" },
      { id: "2", type: "file", label: "3 risk signals found" },
    ];
  }
  return [];
}

function getDefaultTarget(nodeType: string, label: string): string {
  if (nodeType === "orchestrator") return "Full codebase";
  if (nodeType === "cluster") return `${label} scope`;
  return "Assigned endpoints";
}

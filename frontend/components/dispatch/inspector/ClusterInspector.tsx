"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dispatch/common/StatusBadge";
import type { StatusVariant } from "@/components/dispatch/common/StatusBadge";
import { Users, Target, Swords } from "lucide-react";
import type {
  TaskAssignment,
  GraphNode,
  NodeId,
} from "@/lib/dispatch/graphTypes";

interface ClusterInspectorProps {
  clusterId: string;
  assignments: TaskAssignment[];
  graphNodes: Record<NodeId, GraphNode>;
}

const statusToVariant: Record<string, StatusVariant> = {
  idle: "idle",
  running: "running",
  success: "success",
  failed: "failed",
  warning: "warning",
  queued: "planning",
};

export function ClusterInspector({ clusterId, assignments, graphNodes }: ClusterInspectorProps) {
  const attackTypes = [...new Set(assignments.map((a) => a.attack_type))];
  const endpoints = [...new Set(assignments.map((a) => `${a.target.method} ${a.target.endpoint}`))];

  const workerNodes = Object.values(graphNodes).filter(
    (n) => n.type === "worker" && n.clusterId === clusterId
  );

  return (
    <div className="space-y-3">
      {/* Cluster summary */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Swords className="w-3 h-3" />
            Attack Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {attackTypes.length > 0 ? attackTypes.map((at) => (
              <Badge key={at} variant="outline" className="text-[10px] font-mono">
                {at}
              </Badge>
            )) : (
              <span className="text-xs text-muted-foreground">No assignments</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workers in cluster */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="w-3 h-3" />
            Workers ({workerNodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {workerNodes.map((w) => {
              const variant = statusToVariant[w.status] ?? "idle";
              return (
                <div key={w.id} className="flex items-center justify-between gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                  <span className="font-mono truncate text-foreground/80">{w.label}</span>
                  <StatusBadge variant={variant}>{w.status}</StatusBadge>
                </div>
              );
            })}
            {workerNodes.length === 0 && (
              <span className="text-xs text-muted-foreground">No workers in this cluster</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Target className="w-3 h-3" />
            Assigned Endpoints ({endpoints.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {endpoints.map((ep) => (
              <div key={ep} className="text-xs font-mono text-foreground/80 bg-muted/30 rounded px-2 py-1">
                {ep}
              </div>
            ))}
            {endpoints.length === 0 && (
              <span className="text-xs text-muted-foreground">No endpoints assigned</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { SeverityBadge } from "@/components/dispatch/common/SeverityBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Severity } from "@/lib/dispatch/graphTypes";

export interface NodeSummaryCardProps {
  currentTask?: string;
  assignedTarget?: string;
  status: string;
  lastUpdate?: string;
  severity?: Severity;
}

export function NodeSummaryCard({
  currentTask,
  assignedTarget,
  status,
  lastUpdate,
  severity,
}: NodeSummaryCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-xs">
          {currentTask != null && (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-muted-foreground">Task</dt>
              <dd className="text-right text-foreground">{currentTask}</dd>
            </div>
          )}
          {assignedTarget != null && (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-muted-foreground">Target</dt>
              <dd className="font-mono text-foreground">{assignedTarget}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">Status</dt>
            <dd className="capitalize text-foreground">{status}</dd>
          </div>
          {lastUpdate != null && (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-muted-foreground">Last update</dt>
              <dd className="text-foreground">{lastUpdate}</dd>
            </div>
          )}
          {severity != null && (
            <div className="flex items-center justify-between gap-2">
              <dt className="shrink-0 text-muted-foreground">Severity</dt>
              <dd><SeverityBadge severity={severity} /></dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

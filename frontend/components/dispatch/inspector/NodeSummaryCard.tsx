"use client";

import { SeverityBadge } from "@/components/dispatch/common/SeverityBadge";
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
    <div className="rounded-lg border border-dispatch-muted bg-dispatch-slate/50 p-3">
      <h4 className="mb-2 text-xs font-medium text-slate-400">Summary</h4>
      <dl className="space-y-1.5 text-xs">
        {currentTask != null && (
          <div>
            <dt className="text-slate-500">Task</dt>
            <dd className="text-slate-200">{currentTask}</dd>
          </div>
        )}
        {assignedTarget != null && (
          <div>
            <dt className="text-slate-500">Target</dt>
            <dd className="text-slate-200 font-mono">{assignedTarget}</dd>
          </div>
        )}
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="text-slate-200">{status}</dd>
        </div>
        {lastUpdate != null && (
          <div>
            <dt className="text-slate-500">Last update</dt>
            <dd className="text-slate-200">{lastUpdate}</dd>
          </div>
        )}
        {severity != null && (
          <div>
            <dt className="text-slate-500">Severity</dt>
            <dd>
              <SeverityBadge severity={severity} />
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

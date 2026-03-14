"use client";

import type { RunMetrics } from "@/lib/dispatch/graphTypes";

export interface RunMetricsGridProps {
  metrics: RunMetrics;
}

const metricLabels: Record<keyof RunMetrics, string> = {
  routesDiscovered: "Routes discovered",
  workersActive: "Workers active",
  findingsFound: "Findings found",
  ticketsCreated: "Tickets created",
  prsOpened: "PRs opened",
  retestsPassed: "Retests passed",
};

export function RunMetricsGrid({ metrics }: RunMetricsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(metricLabels) as (keyof RunMetrics)[]).map((key) => (
        <div
          key={key}
          className="rounded-lg border border-dispatch-muted bg-dispatch-slate/50 p-3"
        >
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {metricLabels[key]}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
            {metrics[key]}
          </p>
        </div>
      ))}
    </div>
  );
}

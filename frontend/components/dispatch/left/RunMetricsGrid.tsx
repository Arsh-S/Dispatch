"use client";

import type { RunMetrics } from "@/lib/dispatch/graphTypes";
import {
  Route,
  Users,
  Bug,
  Ticket,
  GitPullRequest,
  CheckCheck,
} from "lucide-react";

export interface RunMetricsGridProps {
  metrics: RunMetrics;
}

const metricConfig: { key: keyof RunMetrics; label: string; Icon: React.ElementType }[] = [
  { key: "routesDiscovered", label: "Routes", Icon: Route },
  { key: "workersActive", label: "Workers", Icon: Users },
  { key: "findingsFound", label: "Findings", Icon: Bug },
  { key: "ticketsCreated", label: "Tickets", Icon: Ticket },
  { key: "prsOpened", label: "PRs", Icon: GitPullRequest },
  { key: "retestsPassed", label: "Retests", Icon: CheckCheck },
];

export function RunMetricsGrid({ metrics }: RunMetricsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {metricConfig.map(({ key, label, Icon }) => (
        <div
          key={key}
          className="flex flex-col items-center gap-1 rounded-lg bg-card p-3"
        >
          <Icon className="size-4 text-muted-foreground" />
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {metrics[key]}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

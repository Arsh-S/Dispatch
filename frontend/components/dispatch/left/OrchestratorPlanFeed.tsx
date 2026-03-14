"use client";

import type { PlanPreviewItem } from "@/lib/dispatch/graphTypes";

export interface OrchestratorPlanFeedProps {
  items: PlanPreviewItem[];
}

export function OrchestratorPlanFeed({ items }: OrchestratorPlanFeedProps) {
  return (
    <div className="rounded-lg border border-dispatch-muted bg-dispatch-slate/50 p-3">
      <h3 className="mb-2 text-sm font-medium text-slate-300">Orchestrator plan</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 text-xs text-slate-400"
          >
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-dispatch-blue/60" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

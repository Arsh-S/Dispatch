"use client";

import type { PlanPreviewItem } from "@/lib/dispatch/graphTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export interface OrchestratorPlanFeedProps {
  items: PlanPreviewItem[];
}

export function OrchestratorPlanFeed({ items }: OrchestratorPlanFeedProps) {
  if (items.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Orchestrator Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <CheckCircle2 className="size-3 text-primary" />
              </span>
              <span className="text-foreground/80">{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

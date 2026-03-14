"use client";

import type { PlanPreviewItem } from "@/lib/dispatch/graphTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface OrchestratorPlanFeedProps {
  items: PlanPreviewItem[];
}

function getStatusIcon(status?: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-3 text-primary" />;
    case "in-progress":
      return <Loader2 className="size-3 text-primary animate-spin" />;
    default:
      return <Circle className="size-3 text-muted-foreground" />;
  }
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function OrchestratorPlanFeed({ items }: OrchestratorPlanFeedProps) {
  if (items.length === 0) return null;

  return (
    <Card size="sm" className="ring-border">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Orchestrator Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                {getStatusIcon(item.status)}
              </span>
              <div className="flex-1 flex items-start justify-between gap-2">
                <span
                  className={
                    item.status === "completed"
                      ? "text-foreground/60"
                      : item.status === "in-progress"
                      ? "text-primary"
                      : "text-foreground/80"
                  }
                >
                  {item.label}
                </span>
                {item.timestamp && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTimestamp(item.timestamp)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

"use client";

import { StatusBadge } from "@/components/dispatch/common/StatusBadge";
import type { StatusVariant } from "@/components/dispatch/common/StatusBadge";
import { Clock } from "lucide-react";

export interface NodeHeaderProps {
  name: string;
  type: string;
  state: string;
  timestamp?: string;
  duration?: string;
  clusterLabel?: string;
}

const stateToVariant: Record<string, StatusVariant> = {
  idle: "idle",
  running: "running",
  success: "success",
  failed: "failed",
  warning: "warning",
  fixer: "fixer",
  retest: "retest",
  queued: "planning",
  planning: "planning",
};

export function NodeHeader({
  name,
  type,
  state,
  timestamp,
  duration,
  clusterLabel,
}: NodeHeaderProps) {
  const variant = stateToVariant[state] ?? "idle";
  return (
    <div className="space-y-2 pb-3">
      <h2 className="text-base font-semibold text-foreground">{name}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant="idle">{type}</StatusBadge>
        <StatusBadge variant={variant}>{state}</StatusBadge>
        {duration != null && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {duration}
          </span>
        )}
      </div>
      {clusterLabel != null && (
        <p className="text-xs text-muted-foreground">
          Cluster: <span className="text-foreground/80">{clusterLabel}</span>
        </p>
      )}
      {timestamp != null && (
        <p className="text-xs text-muted-foreground/60">{timestamp}</p>
      )}
    </div>
  );
}

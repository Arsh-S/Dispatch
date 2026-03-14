"use client";

import { StatusBadge } from "@/components/dispatch/common/StatusBadge";
import type { StatusVariant } from "@/components/dispatch/common/StatusBadge";

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
    <div className="border-b border-dispatch-muted pb-3">
      <h2 className="text-base font-semibold text-slate-100">{name}</h2>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <StatusBadge variant="idle">{type}</StatusBadge>
        <StatusBadge variant={variant}>{state}</StatusBadge>
        {duration != null && (
          <span className="text-xs text-slate-500">{duration} active</span>
        )}
      </div>
      {clusterLabel != null && (
        <p className="mt-1 text-xs text-slate-500">Cluster: {clusterLabel}</p>
      )}
      {timestamp != null && (
        <p className="mt-0.5 text-[10px] text-slate-600">{timestamp}</p>
      )}
    </div>
  );
}

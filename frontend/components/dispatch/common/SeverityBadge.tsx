"use client";

import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/dispatch/graphTypes";

const severityClasses: Record<Severity, string> = {
  low: "bg-slate-500/20 text-slate-400 border border-slate-500/40",
  medium: "bg-dispatch-yellow/20 text-dispatch-yellow border border-dispatch-yellow/40",
  high: "bg-dispatch-orange/20 text-dispatch-orange border border-dispatch-orange/40",
  critical: "bg-dispatch-red/20 text-dispatch-red border border-dispatch-red/40",
};

export interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        severityClasses[severity],
        className
      )}
    >
      {severity}
    </span>
  );
}

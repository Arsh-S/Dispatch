"use client";

import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/dispatch/graphTypes";
import {
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  Shield,
} from "lucide-react";

const severityConfig: Record<Severity, { classes: string; Icon: React.ElementType }> = {
  low: {
    classes: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
    Icon: Shield,
  },
  medium: {
    classes: "border-status-running/40 bg-status-running/10 text-status-running",
    Icon: AlertTriangle,
  },
  high: {
    classes: "border-status-warning/40 bg-status-warning/10 text-status-warning",
    Icon: ShieldAlert,
  },
  critical: {
    classes: "border-status-error/40 bg-status-error/10 text-status-error",
    Icon: ShieldX,
  },
};

export interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const { classes, Icon } = severityConfig[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize tracking-tight",
        classes,
        className
      )}
    >
      <Icon className="size-3" />
      {severity}
    </span>
  );
}

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
    classes: "border-dispatch-yellow/40 bg-dispatch-yellow/10 text-dispatch-yellow",
    Icon: AlertTriangle,
  },
  high: {
    classes: "border-dispatch-orange/40 bg-dispatch-orange/10 text-dispatch-orange",
    Icon: ShieldAlert,
  },
  critical: {
    classes: "border-dispatch-red/40 bg-dispatch-red/10 text-dispatch-red",
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

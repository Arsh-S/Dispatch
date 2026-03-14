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
    classes: "bg-muted/50 text-muted-foreground",
    Icon: Shield,
  },
  medium: {
    classes: "bg-muted/50 text-muted-foreground",
    Icon: AlertTriangle,
  },
  high: {
    classes: "bg-destructive/10 text-destructive",
    Icon: ShieldAlert,
  },
  critical: {
    classes: "bg-destructive/10 text-destructive",
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
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize tracking-tight",
        classes,
        className
      )}
    >
      <Icon className="size-3" />
      {severity}
    </span>
  );
}

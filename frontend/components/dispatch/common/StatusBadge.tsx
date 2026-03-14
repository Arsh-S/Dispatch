"use client";

import { cn } from "@/lib/utils";

export type StatusVariant =
  | "idle"
  | "planning"
  | "executing"
  | "completed"
  | "running"
  | "success"
  | "failed"
  | "warning"
  | "fixer"
  | "retest";

const variantClasses: Record<StatusVariant, string> = {
  idle: "border-border bg-muted/50 text-muted-foreground",
  planning: "border-primary/40 bg-primary/10 text-primary",
  executing: "border-status-running/40 bg-status-running/10 text-status-running",
  completed: "border-primary/40 bg-primary/10 text-primary",
  running: "border-status-running/40 bg-status-running/10 text-status-running",
  success: "border-primary/40 bg-primary/10 text-primary",
  failed: "border-status-error/40 bg-status-error/10 text-status-error",
  warning: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  fixer: "border-status-fixer/40 bg-status-fixer/10 text-status-fixer",
  retest: "border-status-retest/40 bg-status-retest/10 text-status-retest",
};

export interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ children, variant = "idle", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize tracking-tight",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

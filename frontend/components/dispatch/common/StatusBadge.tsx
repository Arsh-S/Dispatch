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
  idle: "bg-muted/50 text-muted-foreground",
  planning: "bg-primary/10 text-primary",
  executing: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  running: "bg-primary/10 text-primary",
  success: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  warning: "bg-destructive/10 text-destructive",
  fixer: "bg-primary/10 text-primary",
  retest: "bg-primary/10 text-primary",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize tracking-tight",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

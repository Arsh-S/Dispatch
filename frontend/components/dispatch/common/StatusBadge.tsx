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
  planning: "border-dispatch-blue/40 bg-dispatch-blue/10 text-dispatch-blue",
  executing: "border-dispatch-yellow/40 bg-dispatch-yellow/10 text-dispatch-yellow",
  completed: "border-dispatch-green/40 bg-dispatch-green/10 text-dispatch-green",
  running: "border-dispatch-yellow/40 bg-dispatch-yellow/10 text-dispatch-yellow",
  success: "border-dispatch-green/40 bg-dispatch-green/10 text-dispatch-green",
  failed: "border-dispatch-red/40 bg-dispatch-red/10 text-dispatch-red",
  warning: "border-dispatch-orange/40 bg-dispatch-orange/10 text-dispatch-orange",
  fixer: "border-dispatch-purple/40 bg-dispatch-purple/10 text-dispatch-purple",
  retest: "border-dispatch-teal/40 bg-dispatch-teal/10 text-dispatch-teal",
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

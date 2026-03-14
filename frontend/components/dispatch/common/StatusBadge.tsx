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
  idle: "bg-dispatch-muted text-slate-300",
  planning: "bg-dispatch-blue/20 text-dispatch-blue border border-dispatch-blue/40",
  executing: "bg-dispatch-yellow/20 text-dispatch-yellow border border-dispatch-yellow/40",
  completed: "bg-dispatch-green/20 text-dispatch-green border border-dispatch-green/40",
  running: "bg-dispatch-yellow/20 text-dispatch-yellow border border-dispatch-yellow/40",
  success: "bg-dispatch-green/20 text-dispatch-green border border-dispatch-green/40",
  failed: "bg-dispatch-red/20 text-dispatch-red border border-dispatch-red/40",
  warning: "bg-dispatch-orange/20 text-dispatch-orange border border-dispatch-orange/40",
  fixer: "bg-dispatch-purple/20 text-dispatch-purple border border-dispatch-purple/40",
  retest: "bg-dispatch-teal/20 text-dispatch-teal border border-dispatch-teal/40",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

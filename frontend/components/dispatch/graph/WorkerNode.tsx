"use client";

import { cn } from "@/lib/utils";
import type { NodeStatus } from "@/lib/dispatch/graphTypes";

export interface WorkerNodeProps {
  x: number;
  y: number;
  label: string;
  status: NodeStatus;
  isSelected?: boolean;
  onClick?: () => void;
  size?: number;
}

const statusColors: Record<NodeStatus, string> = {
  idle: "fill-muted-foreground/60",
  queued: "fill-primary/50",
  planning: "fill-primary/60",
  running: "fill-status-running",
  warning: "fill-status-warning",
  failed: "fill-status-error",
  success: "fill-primary",
  fixer: "fill-status-fixer",
  retestVerified: "fill-status-retest",
};

export function WorkerNode({
  x,
  y,
  label,
  status,
  isSelected,
  onClick,
  size = 14,
}: WorkerNodeProps) {
  const fill = statusColors[status] ?? statusColors.idle;
  return (
    <g
      className={cn(
        "cursor-pointer transition-[filter] duration-150 hover:brightness-110",
        isSelected && "drop-shadow-md"
      )}
      onClick={onClick}
    >
      <circle
        r={size / 2}
        cx={x}
        cy={y}
        className={cn(
          "stroke-border stroke",
          fill,
          status === "running" && "animate-pulse",
          isSelected && "stroke-primary stroke-2"
        )}
      />
      <title>{label}</title>
    </g>
  );
}

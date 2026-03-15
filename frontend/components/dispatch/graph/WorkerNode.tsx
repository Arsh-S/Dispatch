"use client";

import { cn } from "@/lib/utils";
import type { NodeStatus, HealthStatus } from "@/lib/dispatch/graphTypes";

export interface WorkerNodeProps {
  x: number;
  y: number;
  label: string;
  status: NodeStatus;
  healthStatus?: HealthStatus;
  isSelected?: boolean;
  onClick?: () => void;
  size?: number;
}

const statusColors: Record<NodeStatus, string> = {
  idle: "fill-muted-foreground/60",
  queued: "fill-primary/50",
  planning: "fill-primary/60",
  running: "fill-primary",
  warning: "fill-destructive/80",
  failed: "fill-destructive",
  success: "fill-primary",
  fixer: "fill-primary/80",
  retestVerified: "fill-primary",
};

export function WorkerNode({
  x,
  y,
  label,
  status,
  healthStatus,
  isSelected,
  onClick,
  size = 14,
}: WorkerNodeProps) {
  const fill = statusColors[status] ?? statusColors.idle;
  const isWarning = healthStatus === "warning";
  const isLooping = healthStatus === "looping";

  return (
    <g
      className={cn(
        "cursor-pointer transition-[filter] duration-150 hover:brightness-110",
        isSelected && "drop-shadow-md"
      )}
      onClick={onClick}
    >
      {/* Warning ring — amber pulse */}
      {isWarning && (
        <circle
          r={size / 2 + 4}
          cx={x}
          cy={y}
          className="fill-none stroke-amber-400 stroke-[1.5] animate-pulse"
        />
      )}
      {/* Looping ring — red pulse */}
      {isLooping && (
        <circle
          r={size / 2 + 4}
          cx={x}
          cy={y}
          className="fill-none stroke-red-500 stroke-2 animate-pulse"
        />
      )}
      <circle
        r={size / 2}
        cx={x}
        cy={y}
        className={cn(
          isLooping ? "fill-red-500" : isWarning ? "fill-amber-400" : fill,
          status === "running" && !isLooping && !isWarning && "animate-pulse",
          isSelected && "stroke-primary stroke-2"
        )}
      />
      <title>{label}{healthStatus && healthStatus !== "healthy" ? ` [${healthStatus}]` : ""}</title>
    </g>
  );
}

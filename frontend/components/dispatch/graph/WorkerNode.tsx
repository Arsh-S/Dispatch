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
  idle: "fill-slate-600",
  queued: "fill-dispatch-blue/50",
  planning: "fill-dispatch-blue/60",
  running: "fill-dispatch-yellow",
  warning: "fill-dispatch-orange",
  failed: "fill-dispatch-red",
  success: "fill-dispatch-green",
  fixer: "fill-dispatch-purple",
  retestVerified: "fill-dispatch-teal",
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
          "stroke-dispatch-muted stroke",
          fill,
          status === "running" && "animate-pulse",
          isSelected && "stroke-dispatch-blue stroke-2"
        )}
      />
      <title>{label}</title>
    </g>
  );
}

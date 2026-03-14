"use client";

import { cn } from "@/lib/utils";

export interface OrchestratorNodeProps {
  x: number;
  y: number;
  phase?: string;
  status: string;
  isSelected?: boolean;
  onClick?: () => void;
  size?: number;
}

const statusRing = {
  idle: "stroke-muted-foreground",
  planning: "stroke-primary animate-pulse",
  executing: "stroke-status-running",
  completed: "stroke-primary",
};

export function OrchestratorNode({
  x,
  y,
  phase = "idle",
  status,
  isSelected,
  onClick,
  size = 48,
}: OrchestratorNodeProps) {
  const r = size / 2;
  const ringClass = statusRing[status as keyof typeof statusRing] ?? statusRing.idle;
  return (
    <g
      className={cn(
        "cursor-pointer transition-[filter] duration-150 hover:brightness-110",
        isSelected && "drop-shadow-lg"
      )}
      onClick={onClick}
    >
      <circle
        r={r + 6}
        cx={x}
        cy={y}
        className={`fill-none stroke-2 ${ringClass} opacity-60`}
      />
      <circle
        r={r}
        cx={x}
        cy={y}
        className={cn(
          "fill-muted stroke-border stroke",
          isSelected && "fill-primary/20 stroke-primary"
        )}
      />
      <text
        x={x}
        y={y - 2}
        textAnchor="middle"
        className="fill-foreground text-[10px] font-medium"
      >
        Orchestrator
      </text>
      <text
        x={x}
        y={y + 10}
        textAnchor="middle"
        className="fill-muted-foreground text-[8px]"
      >
        {phase}
      </text>
    </g>
  );
}

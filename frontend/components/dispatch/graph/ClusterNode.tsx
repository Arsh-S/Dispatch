"use client";

import { cn } from "@/lib/utils";

export interface ClusterNodeProps {
  x: number;
  y: number;
  label: string;
  status: string;
  isSelected?: boolean;
  onClick?: () => void;
  size?: number;
}

const statusFill: Record<string, string> = {
  idle: "fill-muted/80",
  running: "fill-status-running/30",
  success: "fill-primary/30",
  failed: "fill-status-error/30",
};

export function ClusterNode({
  x,
  y,
  label,
  status,
  isSelected,
  onClick,
  size = 28,
}: ClusterNodeProps) {
  const fill =
    statusFill[status] ?? "fill-muted/80";
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
          isSelected && "stroke-primary fill-primary/20"
        )}
      />
      <text
        x={x + size / 2 + 6}
        y={y}
        dominantBaseline="middle"
        className="fill-muted-foreground text-[9px]"
      >
        {label}
      </text>
    </g>
  );
}

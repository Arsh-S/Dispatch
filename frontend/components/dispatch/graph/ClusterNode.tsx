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
  idle: "fill-dispatch-slate",
  running: "fill-dispatch-yellow/30",
  success: "fill-dispatch-green/30",
  failed: "fill-dispatch-red/30",
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
    statusFill[status] ?? "fill-dispatch-slate";
  return (
    <g
      className={cn(
        "cursor-pointer transition-transform hover:scale-105",
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
          isSelected && "stroke-dispatch-blue fill-dispatch-blue/20"
        )}
      />
      <text
        x={x + size / 2 + 6}
        y={y}
        dominantBaseline="middle"
        className="fill-slate-400 text-[9px]"
      >
        {label}
      </text>
    </g>
  );
}

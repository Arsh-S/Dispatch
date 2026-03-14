"use client";

import type { GraphEdge as GraphEdgeType, EdgeKind } from "@/lib/dispatch/graphTypes";

export interface GraphEdgeProps {
  edge: GraphEdgeType;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  isHighlighted?: boolean;
}

const kindStroke: Record<EdgeKind, string> = {
  orchestrator: "stroke-slate-500",
  cluster: "stroke-slate-600",
  worker: "stroke-slate-600",
  finding: "stroke-dispatch-red/60",
  fixer: "stroke-dispatch-purple/60",
  retest: "stroke-dispatch-teal/60",
};

export function GraphEdge({
  edge,
  fromPos,
  toPos,
  isHighlighted,
}: GraphEdgeProps) {
  const stroke = isHighlighted
    ? "stroke-dispatch-blue"
    : kindStroke[edge.kind] ?? "stroke-slate-600";
  return (
    <line
      x1={fromPos.x}
      y1={fromPos.y}
      x2={toPos.x}
      y2={toPos.y}
      className={`${stroke} stroke-[1.5] opacity-70 transition-opacity`}
      strokeOpacity={isHighlighted ? 1 : 0.6}
    />
  );
}

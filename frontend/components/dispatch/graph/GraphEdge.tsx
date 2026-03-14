"use client";

import type { GraphEdge as GraphEdgeType, EdgeKind } from "@/lib/dispatch/graphTypes";

export interface GraphEdgeProps {
  edge: GraphEdgeType;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  isHighlighted?: boolean;
}

const kindStroke: Record<EdgeKind, string> = {
  orchestrator: "stroke-border",
  cluster: "stroke-border",
  worker: "stroke-border",
  finding: "stroke-destructive/60",
  fixer: "stroke-primary/60",
  retest: "stroke-primary/60",
};

export function GraphEdge({
  edge,
  fromPos,
  toPos,
  isHighlighted,
}: GraphEdgeProps) {
  const stroke = isHighlighted
    ? "stroke-primary"
    : kindStroke[edge.kind] ?? "stroke-border";
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

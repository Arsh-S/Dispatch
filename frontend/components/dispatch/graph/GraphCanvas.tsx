"use client";

import { useRef } from "react";
import type { GraphData, NodeId } from "@/lib/dispatch/graphTypes";
import { useForceGraph } from "@/lib/dispatch/useForceGraph";

export interface GraphCanvasProps {
  graphData: GraphData;
  selectedNodeId: NodeId | null;
  onNodeSelect: (id: NodeId | null) => void;
  runStatus: string;
}

export function GraphCanvas({
  graphData,
  selectedNodeId,
  onNodeSelect,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useForceGraph(canvasRef, { graphData, selectedNodeId, onNodeSelect });

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ background: "#0a0a0f" }}
    />
  );
}

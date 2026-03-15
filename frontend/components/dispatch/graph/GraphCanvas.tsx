"use client";

import { useRef } from "react";
import type { GraphData, NodeId, HealthStatus } from "@/lib/dispatch/graphTypes";
import { useForceGraph } from "@/lib/dispatch/useForceGraph";

export interface GraphCanvasProps {
  graphData: GraphData;
  selectedNodeId: NodeId | null;
  onNodeSelect: (id: NodeId | null) => void;
  runStatus: string;
  getWorkerHealthStatus?: (workerId: string) => HealthStatus;
  resetViewRef?: React.MutableRefObject<(() => void) | null>;
}

export function GraphCanvas({
  graphData,
  selectedNodeId,
  onNodeSelect,
  getWorkerHealthStatus,
  resetViewRef,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useForceGraph(canvasRef, {
    graphData,
    selectedNodeId,
    onNodeSelect,
    getWorkerHealthStatus,
    resetViewRef,
  });

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full bg-background"
    />
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import type { GraphData, NodeId } from "@/lib/dispatch/graphTypes";
import { GraphEdge } from "./GraphEdge";
import { OrchestratorNode } from "./OrchestratorNode";
import { ClusterNode } from "./ClusterNode";
import { WorkerNode } from "./WorkerNode";

export interface GraphCanvasProps {
  graphData: GraphData;
  selectedNodeId: NodeId | null;
  onNodeSelect: (id: NodeId | null) => void;
  runStatus: string;
}

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;

export function GraphCanvas({
  graphData,
  selectedNodeId,
  onNodeSelect,
  runStatus,
}: GraphCanvasProps) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const getPos = useCallback(
    (nodeId: NodeId) => {
      const node = graphData.nodes[nodeId];
      if (!node?.position) return { x: 0, y: 0 };
      return node.position;
    },
    [graphData.nodes]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    // Hold Ctrl/Cmd to zoom, otherwise pan with scroll
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setTransform((t) => ({
        ...t,
        scale: Math.min(4, Math.max(0.1, t.scale + delta)),
      }));
      return;
    }

    setTransform((t) => ({
      ...t,
      x: t.x - e.deltaX,
      y: t.y - e.deltaY,
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) dragRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;
      setTransform((t) => ({
        ...t,
        x: t.x + e.clientX - dragRef.current!.x,
        y: t.y + e.clientY - dragRef.current!.y,
      }));
      dragRef.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleFit = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const { nodes, edges } = graphData;
  const nodeIds = Object.keys(nodes);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        backgroundColor: "#050609",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.18) 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <g>
          {edges.map((edge) => {
            const fromPos = getPos(edge.from);
            const toPos = getPos(edge.to);
            const isHighlighted =
              selectedNodeId === edge.from || selectedNodeId === edge.to;
            return (
              <GraphEdge
                key={edge.id}
                edge={edge}
                fromPos={fromPos}
                toPos={toPos}
                isHighlighted={!!isHighlighted}
              />
            );
          })}
        </g>
        <g>
          {nodeIds.map((id) => {
            const node = nodes[id];
            if (!node?.position) return null;
            const { x, y } = node.position;
            const isSelected = selectedNodeId === id;
            if (node.type === "orchestrator") {
              return (
                <OrchestratorNode
                  key={id}
                  x={x}
                  y={y}
                  phase={node.status}
                  status={runStatus}
                  isSelected={isSelected}
                  onClick={() => onNodeSelect(id)}
                  size={node.size}
                />
              );
            }
            if (node.type === "cluster") {
              return (
                <ClusterNode
                  key={id}
                  x={x}
                  y={y}
                  label={node.label}
                  status={node.status}
                  isSelected={isSelected}
                  onClick={() => onNodeSelect(id)}
                  size={node.size}
                />
              );
            }
            return (
              <WorkerNode
                key={id}
                x={x}
                y={y}
                label={node.label}
                status={node.status}
                isSelected={isSelected}
                onClick={() => onNodeSelect(id)}
                size={node.size}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

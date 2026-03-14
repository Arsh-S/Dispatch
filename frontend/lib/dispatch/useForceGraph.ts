"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { GraphData, NodeId, NodeType, NodeStatus } from "./graphTypes";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  nodeType: NodeType;
  status: NodeStatus;
  radius: number;
  color: string;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
}

export interface UseForceGraphOptions {
  graphData: GraphData;
  selectedNodeId: NodeId | null;
  onNodeSelect: (id: NodeId | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Color palette                                                      */
/* ------------------------------------------------------------------ */

const TYPE_COLORS: Record<NodeType, string> = {
  orchestrator: "#7f6df2",
  cluster: "#4a9eff",
  worker: "#a0a0a0",
  finding: "#e05252",
};

const STATUS_OVERRIDES: Partial<Record<NodeStatus, string>> = {
  running: "#e2b340",
  failed: "#e05252",
  success: "#4ade80",
  warning: "#f59e0b",
  fixer: "#a78bfa",
  retestVerified: "#2dd4bf",
};

function nodeColor(type: NodeType, status: NodeStatus): string {
  return STATUS_OVERRIDES[status] ?? TYPE_COLORS[type] ?? "#888";
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useForceGraph(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  { graphData, selectedNodeId, onNodeSelect }: UseForceGraphOptions
) {
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const rafRef = useRef<number>(0);

  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const hoveredRef = useRef<SimNode | null>(null);
  const dragRef = useRef<{
    node: SimNode;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const didDragRef = useRef(false);

  const selectedIdRef = useRef(selectedNodeId);
  selectedIdRef.current = selectedNodeId;

  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  /* ---------- build simulation from graphData ---------- */

  const buildSim = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    const degreeMap: Record<string, number> = {};
    for (const e of graphData.edges) {
      degreeMap[e.from] = (degreeMap[e.from] ?? 0) + 1;
      degreeMap[e.to] = (degreeMap[e.to] ?? 0) + 1;
    }

    const nodes: SimNode[] = Object.values(graphData.nodes).map((n) => {
      const degree = degreeMap[n.id] ?? 0;
      const baseRadius =
        n.type === "orchestrator" ? 10 : n.type === "cluster" ? 6 : 4;
      const radius = baseRadius + Math.min(degree * 1.2, 8);
      return {
        id: n.id,
        label: n.label,
        nodeType: n.type,
        status: n.status,
        radius,
        color: nodeColor(n.type, n.status),
        x: w / 2 + (Math.random() - 0.5) * 200,
        y: h / 2 + (Math.random() - 0.5) * 200,
      };
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = graphData.edges
      .filter((e) => nodeMap.has(e.from) && nodeMap.has(e.to))
      .map((e) => ({
        source: e.from,
        target: e.to,
      }));

    nodesRef.current = nodes;
    linksRef.current = links;

    if (simRef.current) simRef.current.stop();

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        "charge",
        forceManyBody<SimNode>().strength(-300)
      )
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(100)
      )
      .force("center", forceCenter(w / 2, h / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => d.radius + 4)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    simRef.current = sim;

    sim.on("tick", () => {});
  }, [graphData, canvasRef]);

  /* ---------- canvas rendering ---------- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { x: tx, y: ty, k } = transformRef.current;
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const hovered = hoveredRef.current;
    const selected = selectedIdRef.current;

    const connectedIds = new Set<string>();
    if (hovered) {
      connectedIds.add(hovered.id);
      for (const l of links) {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        if (s.id === hovered.id) connectedIds.add(t.id);
        if (t.id === hovered.id) connectedIds.add(s.id);
      }
    }
    const dimming = hovered !== null;

    ctx.clearRect(0, 0, w, h);

    const bg =
      typeof document !== "undefined"
        ? getComputedStyle(document.documentElement)
            .getPropertyValue("--background")
            .trim()
        : "";
    ctx.fillStyle = bg || "oklch(0.1822 0 0)";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(k, k);

    /* --- dotted grid (world space) --- */
    const gridSpacing = 24;
    const dotRadius = 0.6;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    const left = (-tx / k) | 0;
    const top = (-ty / k) | 0;
    const right = Math.ceil((w - tx) / k) + gridSpacing;
    const bottom = Math.ceil((h - ty) / k) + gridSpacing;
    for (let gx = (left / gridSpacing) * gridSpacing; gx <= right; gx += gridSpacing) {
      for (let gy = (top / gridSpacing) * gridSpacing; gy <= bottom; gy += gridSpacing) {
        ctx.beginPath();
        ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* --- edges --- */
    for (const l of links) {
      const s = l.source as SimNode;
      const t = l.target as SimNode;
      const edgeConnected =
        hovered && (s.id === hovered.id || t.id === hovered.id);

      ctx.beginPath();
      ctx.moveTo(s.x!, s.y!);
      ctx.lineTo(t.x!, t.y!);

      if (dimming && !edgeConnected) {
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.lineWidth = 0.5;
      } else if (edgeConnected) {
        ctx.strokeStyle = "rgba(127,109,242,0.6)";
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 0.8;
      }
      ctx.stroke();
    }

    /* --- nodes --- */
    for (const node of nodes) {
      const nx = node.x!;
      const ny = node.y!;
      const r = node.radius;
      const isConnected = connectedIds.has(node.id);
      const isHovered = hovered?.id === node.id;
      const isSelected = selected === node.id;

      let alpha = 1;
      if (dimming && !isConnected) alpha = 0.08;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (isHovered || isSelected) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* --- hover label --- */
    if (hovered) {
      const nx = hovered.x!;
      const ny = hovered.y!;
      const label = hovered.label;
      const fontSize = 12;
      ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "#fff";
      ctx.fillText(label, nx, ny - hovered.radius - 6);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    rafRef.current = requestAnimationFrame(draw);
  }, [canvasRef]);

  /* ---------- coordinate transforms ---------- */

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { x: tx, y: ty, k } = transformRef.current;
    return { x: (sx - tx) / k, y: (sy - ty) / k };
  }, []);

  const findNodeAt = useCallback(
    (wx: number, wy: number): SimNode | null => {
      const nodes = nodesRef.current;
      let closest: SimNode | null = null;
      let minDist = Infinity;
      for (const n of nodes) {
        const dx = n.x! - wx;
        const dy = n.y! - wy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = n.radius + 4;
        if (dist < hitRadius && dist < minDist) {
          minDist = dist;
          closest = n;
        }
      }
      return closest;
    },
    []
  );

  /* ---------- mouse handlers ---------- */

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const node = findNodeAt(world.x, world.y);

      didDragRef.current = false;

      if (node) {
        dragRef.current = {
          node,
          offsetX: node.x! - world.x,
          offsetY: node.y! - world.y,
        };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
      } else {
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        };
      }
    },
    [canvasRef, screenToWorld, findNodeAt]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (dragRef.current) {
        didDragRef.current = true;
        const world = screenToWorld(sx, sy);
        const { node, offsetX, offsetY } = dragRef.current;
        node.fx = world.x + offsetX;
        node.fy = world.y + offsetY;
        return;
      }

      if (panRef.current) {
        didDragRef.current = true;
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        transformRef.current = {
          ...transformRef.current,
          x: panRef.current.tx + dx,
          y: panRef.current.ty + dy,
        };
        return;
      }

      const world = screenToWorld(sx, sy);
      const node = findNodeAt(world.x, world.y);
      hoveredRef.current = node;
      canvas.style.cursor = node ? "grab" : "default";
    },
    [canvasRef, screenToWorld, findNodeAt]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (dragRef.current) {
        const { node } = dragRef.current;
        node.fx = null;
        node.fy = null;
        simRef.current?.alphaTarget(0);

        if (!didDragRef.current) {
          onNodeSelectRef.current(node.id);
        }
        dragRef.current = null;
        return;
      }

      if (panRef.current) {
        if (!didDragRef.current) {
          onNodeSelectRef.current(null);
        }
        panRef.current = null;
        return;
      }
    },
    []
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const t = transformRef.current;
      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
      const newK = Math.min(6, Math.max(0.1, t.k * zoomFactor));

      const newX = mx - ((mx - t.x) / t.k) * newK;
      const newY = my - ((my - t.y) / t.k) * newK;

      transformRef.current = { x: newX, y: newY, k: newK };
    },
    [canvasRef]
  );

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    buildSim();
    rafRef.current = requestAnimationFrame(draw);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseup", handleMouseUp);
      canvas.addEventListener("mouseleave", handleMouseUp);
      canvas.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      simRef.current?.stop();
      if (canvas) {
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("mouseleave", handleMouseUp);
        canvas.removeEventListener("wheel", handleWheel);
      }
    };
  }, [buildSim, draw, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, canvasRef]);
}

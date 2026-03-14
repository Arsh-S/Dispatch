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
  displayLabel: string;
  labelLines: string[];
  nodeType: NodeType;
  status: NodeStatus;
  hopDistance: number | null;
  baseRadius: number;
  radius: number;
  color: string;
  textColor: string;
  fontSize: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
}

export interface UseForceGraphOptions {
  graphData: GraphData;
  selectedNodeId: NodeId | null;
  onNodeSelect: (id: NodeId | null) => void;
  /** Optional ref to receive a resetView() function (pan/zoom to initial). */
  resetViewRef?: React.MutableRefObject<(() => void) | null>;
}

/* ------------------------------------------------------------------ */
/*  Color palette - Supabase themed (emerald greens + neutral grays)  */
/* ------------------------------------------------------------------ */

// Supabase emerald primary: oklch(0.4365 0.1044 156.7556) ≈ #3ecf8e
const SUPABASE_GREEN = "#3ecf8e";
const SUPABASE_GREEN_DIM = "#2a9d6a";

const TYPE_COLORS: Record<NodeType, string> = {
  orchestrator: SUPABASE_GREEN,    // Primary green for orchestrator
  cluster: "#6b7280",              // Neutral gray for clusters
  worker: "#4b5563",               // Darker gray for workers
  finding: "#ef6461",              // Muted coral for findings
};

const STATUS_OVERRIDES: Partial<Record<NodeStatus, string>> = {
  running: "#d4a853",              // Warm amber
  failed: "#ef6461",               // Muted coral
  success: SUPABASE_GREEN,         // Supabase green
  warning: "#e5954a",              // Soft orange
  fixer: "#9f7aea",                // Muted purple
  retestVerified: "#4fd1c5",       // Soft teal
};

function nodeColor(type: NodeType, status: NodeStatus): string {
  return STATUS_OVERRIDES[status] ?? TYPE_COLORS[type] ?? "#6b7280";
}

function getDisplayLabel(label: string, nodeType: NodeType): string {
  if (nodeType === "finding") {
    const shortLabel = label.split(":")[0]?.trim();
    return shortLabel ? shortLabel.replace(/-/g, " ") : label;
  }

  return label.replace(/-/g, " ");
}

function splitLabel(label: string, maxLineLength: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [label];

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    const candidate = `${currentLine} ${word}`;
    if (candidate.length <= maxLineLength || lines.length >= 1) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= 2) {
    return lines;
  }

  const mergedTail = lines.slice(1).join(" ");
  return [
    lines[0],
    mergedTail.length > maxLineLength + 3
      ? `${mergedTail.slice(0, maxLineLength).trimEnd()}...`
      : mergedTail,
  ];
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function getTextColor(fill: string) {
  const rgb = hexToRgb(fill);
  if (!rgb) return "#f8fafc";

  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;

  return luminance > 0.58 ? "#0f172a" : "#f8fafc";
}

function getLabelMetrics(label: string, nodeType: NodeType) {
  const displayLabel = getDisplayLabel(label, nodeType);
  const labelLines = splitLabel(
    displayLabel,
    nodeType === "orchestrator" ? 14 : nodeType === "finding" ? 12 : 11
  );
  const longestLineLength = labelLines.reduce(
    (max, line) => Math.max(max, line.length),
    0
  );

  return { displayLabel, labelLines, longestLineLength };
}

function getHopDistances(graphData: GraphData, rootId: string) {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of graphData.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const distances = new Map<string, number>();
  const queue: string[] = [rootId];
  distances.set(rootId, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const currentDistance = distances.get(current) ?? 0;
    const neighbors = adjacency.get(current);
    for (const neighbor of neighbors ? Array.from(neighbors) : []) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, currentDistance + 1);
      queue.push(neighbor);
    }
  }

  return distances;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useForceGraph(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  { graphData, selectedNodeId, onNodeSelect, resetViewRef }: UseForceGraphOptions
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
    const hopDistances = getHopDistances(graphData, "orchestrator");
    for (const e of graphData.edges) {
      degreeMap[e.from] = (degreeMap[e.from] ?? 0) + 1;
      degreeMap[e.to] = (degreeMap[e.to] ?? 0) + 1;
    }

    const nodes: SimNode[] = Object.values(graphData.nodes).map((n) => {
      const degree = degreeMap[n.id] ?? 0;
      const { displayLabel, labelLines, longestLineLength } = getLabelMetrics(
        n.label,
        n.type
      );
      const hopDistance = hopDistances.get(n.id) ?? null;
      const sizeHint = n.size ? n.size / 2 : 0;
      const baseRadius =
        n.type === "orchestrator"
          ? Math.max(sizeHint, 24)
          : n.type === "cluster"
          ? Math.max(sizeHint, 14)
          : n.type === "finding"
          ? Math.max(sizeHint, 10)
          : Math.max(sizeHint, 7);
      const workerScale =
        n.type === "worker"
          ? Math.max(0.7, 1.15 - Math.max((hopDistance ?? 2) - 1, 0) * 0.15)
          : 1;
      const radius = Math.max(
        6,
        Math.round((baseRadius + Math.min(degree * 0.3, 2)) * workerScale)
      );
      const fontSize = Math.max(
        9,
        Math.min(13, Math.floor(radius / (labelLines.length > 1 ? 2.4 : 1.9)))
      );
      const color = nodeColor(n.type, n.status);
      return {
        id: n.id,
        label: n.label,
        displayLabel,
        labelLines,
        nodeType: n.type,
        status: n.status,
        hopDistance,
        baseRadius: radius,
        radius,
        color,
        textColor: getTextColor(color),
        fontSize,
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
        forceCollide<SimNode>().radius((d) => d.radius + 10)
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

    /* --- dotted grid in world space (pans/zooms with graph) --- */
    const gridSpacing = 24;
    const dotRadius = 0.6;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    const worldLeft = -tx / k;
    const worldTop = -ty / k;
    const worldRight = (w - tx) / k;
    const worldBottom = (h - ty) / k;
    const startX = Math.floor(worldLeft / gridSpacing) * gridSpacing;
    const startY = Math.floor(worldTop / gridSpacing) * gridSpacing;
    const endX = Math.ceil(worldRight / gridSpacing) * gridSpacing + gridSpacing;
    const endY = Math.ceil(worldBottom / gridSpacing) * gridSpacing + gridSpacing;
    for (let gx = startX; gx <= endX; gx += gridSpacing) {
      for (let gy = startY; gy <= endY; gy += gridSpacing) {
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
        ctx.strokeStyle = "rgba(62,207,142,0.6)"; // Supabase green
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

    if (hovered) {
      const nx = hovered.x!;
      const ny = hovered.y!;
      const hoverFontSize = Math.round(hovered.fontSize * 1.35);
      const hoverLabel = hovered.displayLabel.toUpperCase();

      ctx.save();
      ctx.font = `800 ${hoverFontSize}px Outfit, ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";

      const startY = ny - hovered.radius - hoverFontSize - 8;
      ctx.fillText(hoverLabel, nx, startY);

      ctx.restore();
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

  const resetView = useCallback(() => {
    transformRef.current = { x: 0, y: 0, k: 1 };
  }, []);

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    if (resetViewRef) resetViewRef.current = resetView;

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
      if (resetViewRef) resetViewRef.current = null;
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
  }, [buildSim, draw, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, canvasRef, resetView, resetViewRef]);
}

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
/*  Graph fingerprint for change detection                             */
/* ------------------------------------------------------------------ */

function computeGraphFingerprint(graphData: GraphData): string {
  const nodeIds = Object.keys(graphData.nodes).sort().join(",");
  const edgeKeys = graphData.edges
    .map((e) => `${e.from}->${e.to}`)
    .sort()
    .join(",");
  return `${nodeIds}|${edgeKeys}`;
}

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
  /** Optional ref to receive a resetView() function (pan/zoom to initial). */
  resetViewRef?: React.MutableRefObject<(() => void) | null>;
}

/* ------------------------------------------------------------------ */
/*  Color palette - Supabase themed (emerald greens + neutral grays)  */
/* ------------------------------------------------------------------ */

// Supabase emerald primary: oklch(0.4365 0.1044 156.7556) ≈ #3ecf8e
const SUPABASE_GREEN = "#3ecf8e";
const SUPABASE_GREEN_DIM = "#2a9d6a";
const IDLE_ALPHA_TARGET = 0.05;
const DRAG_ALPHA_TARGET = 0.3;
const COLD_START_ALPHA = 1;
const RESTORE_ALPHA = 0.18;
const OVERLAP_REHEAT_ALPHA = 0.38;
const LAYOUT_STORAGE_PREFIX = "dispatch-force-layout:";

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

function loadStoredLayout(fingerprint: string): Map<string, { x: number; y: number }> {
  if (typeof window === "undefined") return new Map();

  try {
    const raw = window.sessionStorage.getItem(`${LAYOUT_STORAGE_PREFIX}${fingerprint}`);
    if (!raw) return new Map();

    const parsed = JSON.parse(raw) as Record<string, { x?: number; y?: number }>;
    return new Map(
      Object.entries(parsed)
        .filter(([, position]) => typeof position?.x === "number" && typeof position?.y === "number")
        .map(([id, position]) => [id, { x: position.x as number, y: position.y as number }])
    );
  } catch {
    return new Map();
  }
}

function saveStoredLayout(fingerprint: string, nodes: SimNode[]) {
  if (typeof window === "undefined" || !fingerprint || nodes.length === 0) return;

  try {
    const positions = Object.fromEntries(
      nodes
        .filter((node) => node.x !== undefined && node.y !== undefined)
        .map((node) => [node.id, { x: node.x as number, y: node.y as number }])
    );

    window.sessionStorage.setItem(
      `${LAYOUT_STORAGE_PREFIX}${fingerprint}`,
      JSON.stringify(positions)
    );
  } catch {
    // Ignore storage failures; layout persistence is best-effort only.
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nudgeOverlappingNodes(nodes: SimNode[]): number {
  let nudgedCount = 0;

  for (const node of nodes) {
    if (node.nodeType === "orchestrator" || node.x === undefined || node.y === undefined) {
      continue;
    }

    let pushX = 0;
    let pushY = 0;
    let collisions = 0;

    for (const other of nodes) {
      if (other === node || other.x === undefined || other.y === undefined) continue;

      const minDistance = node.radius + other.radius + 10;
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= minDistance) continue;

      collisions += 1;

      let angle = Math.atan2(dy, dx);
      if (!Number.isFinite(angle) || distance < 0.001) {
        angle = ((hashString(`${node.id}:${other.id}`) % 360) * Math.PI) / 180;
      }

      const overlap = minDistance - Math.max(distance, 0.001);
      pushX += Math.cos(angle) * overlap;
      pushY += Math.sin(angle) * overlap;
    }

    if (collisions === 0) continue;

    node.x += pushX / collisions;
    node.y += pushY / collisions;
    node.vx = pushX * 0.04;
    node.vy = pushY * 0.04;
    nudgedCount += 1;
  }

  return nudgedCount;
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
  const prevFingerprintRef = useRef<string>("");
  const initialBuildDoneRef = useRef(false);

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

    // Skip rebuild if graph structure hasn't changed (but always build on first call)
    const fingerprint = computeGraphFingerprint(graphData);
    if (initialBuildDoneRef.current && fingerprint === prevFingerprintRef.current && nodesRef.current.length > 0) {
      return;
    }
    prevFingerprintRef.current = fingerprint;
    initialBuildDoneRef.current = true;

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    const degreeMap: Record<string, number> = {};
    for (const e of graphData.edges) {
      degreeMap[e.from] = (degreeMap[e.from] ?? 0) + 1;
      degreeMap[e.to] = (degreeMap[e.to] ?? 0) + 1;
    }

    // Preserve positions of existing nodes
    const existingPositions = loadStoredLayout(fingerprint);
    for (const node of nodesRef.current) {
      if (node.x !== undefined && node.y !== undefined) {
        existingPositions.set(node.id, { x: node.x, y: node.y });
      }
    }
    const isRestoringLayout = existingPositions.size > 0;

    const nodes: SimNode[] = Object.values(graphData.nodes).map((n) => {
      const degree = degreeMap[n.id] ?? 0;
      const isOrchestrator = n.type === "orchestrator";
      const baseRadius = isOrchestrator ? 18 : n.type === "cluster" ? 6 : 4;
      const radius = baseRadius + Math.min(degree * 1.2, 8);
      const existingPos = existingPositions.get(n.id);

      const node: SimNode = {
        id: n.id,
        label: n.label,
        nodeType: n.type,
        status: n.status,
        radius,
        color: isOrchestrator ? "#ffffff" : nodeColor(n.type, n.status),
        x: isOrchestrator ? w / 2 : (existingPos?.x ?? w / 2 + (Math.random() - 0.5) * 200),
        y: isOrchestrator ? h / 2 : (existingPos?.y ?? h / 2 + (Math.random() - 0.5) * 200),
      };

      // Fix orchestrator at center
      if (isOrchestrator) {
        node.fx = w / 2;
        node.fy = h / 2;
      } else if (existingPos) {
        // Start restored nodes without residual momentum, then gently reheat.
        node.vx = 0;
        node.vy = 0;
      }

      return node;
    });

    const nudgedNodeCount = isRestoringLayout ? nudgeOverlappingNodes(nodes) : 0;
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
        forceManyBody<SimNode>().strength(-400)
      )
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(120)
      )
      .force("center", forceCenter(w / 2, h / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => d.radius + 6)
      )
      .alphaDecay(0)
      .alphaTarget(IDLE_ALPHA_TARGET)
      .velocityDecay(0.4);

    simRef.current = sim;

    sim.on("tick", () => {});

    // Restored layouts get a light reheat, with extra energy only if overlaps were detected.
    sim
      .alpha(
        !isRestoringLayout
          ? COLD_START_ALPHA
          : nudgedNodeCount > 0
            ? OVERLAP_REHEAT_ALPHA
            : RESTORE_ALPHA
      )
      .restart();
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
      const isOrchestrator = node.nodeType === "orchestrator";

      let alpha = 1;
      if (dimming && !isConnected) alpha = 0.08;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (isHovered || isSelected) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isOrchestrator ? 12 : 8;
      }

      ctx.beginPath();
      if (isOrchestrator) {
        // Draw square for orchestrator
        const size = r * 1.8;
        ctx.rect(nx - size / 2, ny - size / 2, size, size);
      } else {
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
      }
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
      const label = hovered.label.toUpperCase();
      const fontSize = 11;
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.letterSpacing = "0.05em";

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
        simRef.current?.alphaTarget(DRAG_ALPHA_TARGET).restart();
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
        simRef.current?.alphaTarget(IDLE_ALPHA_TARGET).restart();

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

  /* ---------- sync node properties without rebuilding ---------- */

  useEffect(() => {
    // Update existing node properties (status, color) without rebuilding simulation
    const nodeMap = new Map(
      Object.values(graphData.nodes).map((n) => [n.id, n])
    );
    for (const simNode of nodesRef.current) {
      const dataNode = nodeMap.get(simNode.id);
      if (dataNode) {
        simNode.status = dataNode.status;
        simNode.color = nodeColor(dataNode.type, dataNode.status);
        simNode.label = dataNode.label;
      }
    }
  }, [graphData]);

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    buildSim();
  }, [buildSim]);

  useEffect(() => {
    const persistLayout = () => {
      saveStoredLayout(prevFingerprintRef.current, nodesRef.current);
    };

    window.addEventListener("pagehide", persistLayout);
    return () => {
      persistLayout();
      window.removeEventListener("pagehide", persistLayout);
    };
  }, []);

  useEffect(() => {
    if (resetViewRef) resetViewRef.current = resetView;
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
  }, [draw, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, canvasRef, resetView, resetViewRef]);
}

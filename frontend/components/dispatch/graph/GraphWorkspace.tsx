"use client";

import { useRef } from "react";
import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { GraphCanvas } from "./GraphCanvas";
import { Button } from "@/components/ui/button";
import { Maximize, RotateCcw } from "lucide-react";

export function GraphWorkspace() {
  const {
    graphData,
    selectedNodeId,
    selectNode,
    runStatus,
    getWorkerHealthStatus,
  } = useDispatchWorkspace();

  const resetViewRef = useRef<(() => void) | null>(null);

  const handleFit = () => {};
  const handleReset = () => resetViewRef.current?.();

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      <div className="relative flex-1 min-h-0 overflow-visible">
        <GraphCanvas
          graphData={graphData}
          selectedNodeId={selectedNodeId}
          onNodeSelect={selectNode}
          runStatus={runStatus}
          getWorkerHealthStatus={getWorkerHealthStatus}
          resetViewRef={resetViewRef}
        />
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="pointer-events-auto absolute left-3 top-3">
            <div className="rounded-lg border border-border bg-card/90 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] text-muted-foreground">
                Drag to pan &middot; Scroll to zoom &middot; Click to inspect
              </p>
            </div>
          </div>
          {/* Zoom/pan controls — bottom-right */}
          <div className="pointer-events-auto absolute bottom-3 right-3 flex gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={handleFit}
              title="Fit to screen"
              className="bg-card/90 backdrop-blur-sm"
            >
              <Maximize className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={handleReset}
              title="Reset view"
              className="bg-card/90 backdrop-blur-sm"
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>
          {/* Minimal legend — bottom-left */}
          <div className="pointer-events-auto absolute bottom-3 left-3">
            <MinimalLegend />
          </div>
        </div>
      </div>
    </div>
  );
}

function MinimalLegend() {
  const items = [
    { color: "#d4a853", label: "Running" },
    { color: "var(--primary)", label: "Success" },
    { color: "#ef6461", label: "Failed" },
    { color: "#e5954a", label: "Warning" },
    { color: "#6b7280", label: "Idle" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card/90 px-3 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

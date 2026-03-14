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
          resetViewRef={resetViewRef}
        />
        <div className="pointer-events-none absolute inset-0 z-10">
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
    { color: "bg-status-running", label: "Running" },
    { color: "bg-primary", label: "Success" },
    { color: "bg-status-error", label: "Failed" },
    { color: "bg-status-warning", label: "Warning" },
    { color: "bg-status-idle", label: "Idle" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card/90 px-3 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${color}`} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[9px] text-muted-foreground/60">
        Drag to pan &middot; Scroll to zoom &middot; Click to inspect
      </p>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { GraphToolbar } from "./GraphToolbar";
import { GraphCanvas } from "./GraphCanvas";
import { GraphLegend } from "./GraphLegend";

export function GraphWorkspace() {
  const {
    graphData,
    selectedNodeId,
    selectNode,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    runStatus,
  } = useDispatchWorkspace();

  const resetViewRef = useRef<(() => void) | null>(null);

  const handleFit = () => {};
  const handleReset = () => resetViewRef.current?.();

  return (
    <div className="relative flex h-full flex-col bg-background">
      <GraphToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
        onFitToScreen={handleFit}
        onResetLayout={handleReset}
      />
      <div className="relative flex-1 min-h-0 overflow-visible">
        <GraphCanvas
          graphData={graphData}
          selectedNodeId={selectedNodeId}
          onNodeSelect={selectNode}
          runStatus={runStatus}
          resetViewRef={resetViewRef}
        />
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="pointer-events-auto absolute bottom-3 left-3">
            <GraphLegend />
          </div>
        </div>
      </div>
    </div>
  );
}

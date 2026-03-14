"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { GraphToolbar } from "./GraphToolbar";
import { GraphCanvas } from "./GraphCanvas";
import { GraphLegend } from "./GraphLegend";
import { MiniMap } from "./MiniMap";

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

  const handleFit = () => {};
  const handleReset = () => {};

  return (
    <div className="relative flex h-full flex-col bg-dispatch-charcoal">
      <GraphToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
        onFitToScreen={handleFit}
        onResetLayout={handleReset}
      />
      <div className="relative flex-1">
        <GraphCanvas
          graphData={graphData}
          selectedNodeId={selectedNodeId}
          onNodeSelect={selectNode}
          runStatus={runStatus}
        />
        <GraphLegend />
        <div className="absolute bottom-3 right-3">
          <MiniMap />
        </div>
      </div>
    </div>
  );
}

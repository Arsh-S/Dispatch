"use client";

import { CommandSearch } from "@/components/dispatch/common/CommandSearch";
import { FilterBar } from "@/components/dispatch/common/FilterBar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { GraphFilters } from "@/lib/dispatch/state";
import { Maximize, RotateCcw } from "lucide-react";

export interface GraphToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filters: GraphFilters;
  onFilterChange: (f: Partial<GraphFilters>) => void;
  onFitToScreen: () => void;
  onResetLayout: () => void;
}

export function GraphToolbar({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  onFitToScreen,
  onResetLayout,
}: GraphToolbarProps) {
  return (
    <div className="flex items-center gap-2 bg-card/30 px-3 py-2">
      <CommandSearch
        value={searchQuery}
        onChange={onSearchChange}
        className="w-64"
      />
      <Separator orientation="vertical" className="h-6 opacity-0" />
      <FilterBar filters={filters} onFilterChange={onFilterChange} className="flex-1" />
      <Separator orientation="vertical" className="h-6 opacity-0" />
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={onFitToScreen}
          title="Fit to screen"
        >
          <Maximize className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={onResetLayout}
          title="Reset view"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

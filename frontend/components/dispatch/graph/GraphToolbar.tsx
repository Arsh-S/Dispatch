"use client";

import { CommandSearch } from "@/components/dispatch/common/CommandSearch";
import { FilterBar } from "@/components/dispatch/common/FilterBar";
import type { GraphFilters } from "@/lib/dispatch/state";

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
    <div className="flex flex-col gap-2 border-b border-dispatch-muted bg-dispatch-slate/30 px-3 py-2">
      <CommandSearch
        value={searchQuery}
        onChange={onSearchChange}
        className="w-full"
      />
      <div className="flex items-center justify-between gap-2">
        <FilterBar filters={filters} onFilterChange={onFilterChange} />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onFitToScreen}
            className="rounded border border-dispatch-muted bg-dispatch-slate px-2 py-1 text-[10px] text-slate-400 hover:bg-dispatch-muted hover:text-slate-300"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={onResetLayout}
            className="rounded border border-dispatch-muted bg-dispatch-slate px-2 py-1 text-[10px] text-slate-400 hover:bg-dispatch-muted hover:text-slate-300"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

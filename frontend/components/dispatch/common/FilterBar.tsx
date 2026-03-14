"use client";

import { cn } from "@/lib/utils";
import type { GraphFilters } from "@/lib/dispatch/state";

export interface FilterBarProps {
  filters: GraphFilters;
  onFilterChange: (f: Partial<GraphFilters>) => void;
  className?: string;
}

const filterOptions: { key: keyof GraphFilters; label: string }[] = [
  { key: "showCriticalPath", label: "Critical path" },
  { key: "showFailedOnly", label: "Failed only" },
  { key: "showFixerLoop", label: "Fixer loop" },
  { key: "showReportingChain", label: "Reporting chain" },
];

export function FilterBar({ filters, onFilterChange, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {filterOptions.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onFilterChange({ [key]: !filters[key] })}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            filters[key]
              ? "bg-dispatch-blue/30 text-dispatch-blue border border-dispatch-blue/50"
              : "bg-dispatch-slate text-slate-400 border border-dispatch-muted hover:border-dispatch-muted hover:text-slate-300"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

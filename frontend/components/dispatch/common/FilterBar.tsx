"use client";

import { cn } from "@/lib/utils";
import type { GraphFilters } from "@/lib/dispatch/state";
import {
  Zap,
  XCircle,
  Wrench,
  FileText,
} from "lucide-react";

export interface FilterBarProps {
  filters: GraphFilters;
  onFilterChange: (f: Partial<GraphFilters>) => void;
  className?: string;
}

const filterOptions: { key: keyof GraphFilters; label: string; Icon: React.ElementType }[] = [
  { key: "showCriticalPath", label: "Critical path", Icon: Zap },
  { key: "showFailedOnly", label: "Failed only", Icon: XCircle },
  { key: "showFixerLoop", label: "Fixer loop", Icon: Wrench },
  { key: "showReportingChain", label: "Reporting chain", Icon: FileText },
];

export function FilterBar({ filters, onFilterChange, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {filterOptions.map(({ key, label, Icon }) => {
        const active = filters[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange({ [key]: !active })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

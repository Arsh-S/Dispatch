"use client";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export interface CommandSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CommandSearch({
  value,
  onChange,
  placeholder = "Search routes, workers, findings…",
  className = "",
}: CommandSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md bg-card pl-8 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </div>
  );
}

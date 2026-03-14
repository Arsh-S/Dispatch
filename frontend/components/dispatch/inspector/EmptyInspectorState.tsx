"use client";

import { MousePointerClick } from "lucide-react";

export function EmptyInspectorState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <MousePointerClick className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No node selected</p>
        <p className="text-xs text-muted-foreground">
          Click a node in the graph to inspect details, logs, and related assets.
        </p>
      </div>
    </div>
  );
}

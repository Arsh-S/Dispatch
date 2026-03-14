"use client";

export function EmptyInspectorState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <p className="text-sm text-slate-500">No node selected</p>
      <p className="text-xs text-slate-600">
        Click a node in the graph to inspect details, logs, and related assets.
      </p>
    </div>
  );
}

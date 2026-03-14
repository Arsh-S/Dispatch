"use client";

const items = [
  { color: "bg-status-idle", label: "Idle" },
  { color: "bg-primary", label: "Planning" },
  { color: "bg-status-running", label: "Running" },
  { color: "bg-status-warning", label: "Warning" },
  { color: "bg-status-error", label: "Failed" },
  { color: "bg-primary", label: "Success" },
  { color: "bg-status-fixer", label: "Fixer" },
  { color: "bg-status-retest", label: "Retest" },
];

export function GraphLegend() {
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
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

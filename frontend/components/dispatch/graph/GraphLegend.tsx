"use client";

const items = [
  { color: "bg-muted-foreground/60", label: "Idle" },
  { color: "bg-primary/50", label: "Planning" },
  { color: "bg-primary", label: "Running" },
  { color: "bg-destructive/80", label: "Warning" },
  { color: "bg-destructive", label: "Failed" },
  { color: "bg-primary", label: "Success" },
  { color: "bg-primary/80", label: "Fixer" },
  { color: "bg-primary", label: "Retest" },
];

export function GraphLegend() {
  return (
    <div className="rounded-md bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground/60">
        Drag to pan &middot; Scroll to zoom &middot; Click to inspect
      </p>
    </div>
  );
}

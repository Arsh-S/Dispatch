"use client";

const items = [
  { color: "bg-muted-foreground/60", label: "Idle" },
  { color: "bg-dispatch-blue", label: "Planning" },
  { color: "bg-dispatch-yellow", label: "Running" },
  { color: "bg-dispatch-orange", label: "Warning" },
  { color: "bg-dispatch-red", label: "Failed" },
  { color: "bg-dispatch-green", label: "Success" },
  { color: "bg-dispatch-purple", label: "Fixer" },
  { color: "bg-dispatch-teal", label: "Retest" },
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

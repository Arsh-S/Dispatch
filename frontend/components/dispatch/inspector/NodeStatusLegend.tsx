"use client";

const STATUS_ITEMS = [
  { color: "bg-muted-foreground/60", label: "Idle" },
  { color: "bg-primary/50", label: "Queued / planning" },
  { color: "bg-primary", label: "Running" },
  { color: "bg-destructive/80", label: "Warning" },
  { color: "bg-destructive", label: "Failed / critical" },
  { color: "bg-primary", label: "Success" },
  { color: "bg-primary/80", label: "Fixer" },
  { color: "bg-primary", label: "Retest verified" },
];

export function NodeStatusLegend() {
  return (
    <div className="mt-4 rounded-md bg-card p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Node status
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {STATUS_ITEMS.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`size-2 shrink-0 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

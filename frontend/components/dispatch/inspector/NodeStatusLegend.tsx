"use client";

const STATUS_ITEMS = [
  { color: "bg-status-idle", label: "Idle" },
  { color: "bg-primary", label: "Queued / planning" },
  { color: "bg-status-running", label: "Running" },
  { color: "bg-status-warning", label: "Warning" },
  { color: "bg-status-error", label: "Failed / critical" },
  { color: "bg-primary", label: "Success" },
  { color: "bg-status-fixer", label: "Fixer" },
  { color: "bg-status-retest", label: "Retest verified" },
];

export function NodeStatusLegend() {
  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Node status
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {STATUS_ITEMS.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`size-2 shrink-0 rounded-full ${color}`} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

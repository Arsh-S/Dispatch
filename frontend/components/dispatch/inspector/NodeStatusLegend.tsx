"use client";

const STATUS_ITEMS = [
  { color: "bg-muted-foreground/60", label: "Idle" },
  { color: "bg-dispatch-blue", label: "Queued / planning" },
  { color: "bg-dispatch-yellow", label: "Running" },
  { color: "bg-dispatch-orange", label: "Warning" },
  { color: "bg-dispatch-red", label: "Failed / critical" },
  { color: "bg-dispatch-green", label: "Success" },
  { color: "bg-dispatch-purple", label: "Fixer" },
  { color: "bg-dispatch-teal", label: "Retest verified" },
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

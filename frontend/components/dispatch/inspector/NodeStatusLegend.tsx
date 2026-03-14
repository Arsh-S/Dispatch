"use client";

const STATUS_ITEMS = [
  { color: "bg-slate-600", label: "Idle" },
  { color: "bg-dispatch-blue/60", label: "Queued / planning" },
  { color: "bg-dispatch-yellow", label: "Running" },
  { color: "bg-dispatch-orange", label: "Warning" },
  { color: "bg-dispatch-red", label: "Failed / critical" },
  { color: "bg-dispatch-green", label: "Success" },
  { color: "bg-dispatch-purple", label: "Fixer" },
  { color: "bg-dispatch-teal", label: "Retest verified" },
];

export function NodeStatusLegend() {
  return (
    <div className="mt-6 rounded-lg border border-dispatch-muted bg-dispatch-slate/50 px-3 py-2">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Node status
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {STATUS_ITEMS.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${color}`} />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

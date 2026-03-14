"use client";

export function GraphLegend() {
  const items = [
    { color: "bg-slate-600", label: "Idle" },
    { color: "bg-dispatch-blue/60", label: "Queued / planning" },
    { color: "bg-dispatch-yellow", label: "Running" },
    { color: "bg-dispatch-orange", label: "Warning" },
    { color: "bg-dispatch-red", label: "Failed / critical" },
    { color: "bg-dispatch-green", label: "Success" },
    { color: "bg-dispatch-purple", label: "Fixer" },
    { color: "bg-dispatch-teal", label: "Retest verified" },
  ];
  return (
    <div className="absolute bottom-3 left-3 rounded-lg border border-dispatch-muted bg-dispatch-slate/90 px-2.5 py-2 shadow-lg">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Node status
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${color}`} />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[9px] text-slate-500">
        Drag to pan · Scroll to zoom · Click node to inspect
      </p>
    </div>
  );
}

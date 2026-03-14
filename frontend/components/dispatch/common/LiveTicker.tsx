"use client";

export interface LiveTickerEvent {
  id: string;
  message: string;
  kind?: "finding" | "fixer" | "retest" | "info";
  timestamp?: string;
}

export interface LiveTickerProps {
  events: LiveTickerEvent[];
  className?: string;
}

export function LiveTicker({ events, className = "" }: LiveTickerProps) {
  if (events.length === 0) return null;
  return (
    <div
      className={`flex items-center gap-4 overflow-x-auto border-t border-dispatch-muted bg-dispatch-slate/50 px-3 py-2 text-xs text-slate-400 ${className}`}
    >
      {events.slice(-8).map((e) => (
        <span key={e.id} className="whitespace-nowrap">
          <span className="text-slate-500">{e.timestamp ?? "—"}</span>{" "}
          <span className="text-slate-300">{e.message}</span>
        </span>
      ))}
    </div>
  );
}

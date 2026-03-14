"use client";

import type { NodeEvent } from "@/lib/dispatch/graphTypes";

export interface NodeActivityFeedProps {
  events: NodeEvent[];
}

const levelIcon: Record<string, string> = {
  info: "○",
  warn: "⚠",
  error: "✕",
  success: "✓",
};

export function NodeActivityFeed({ events }: NodeActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dispatch-muted bg-dispatch-slate/30 p-3">
        <h4 className="mb-2 text-xs font-medium text-slate-400">Activity</h4>
        <p className="text-xs text-slate-500">No events yet.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dispatch-muted bg-dispatch-slate/30 p-3">
      <h4 className="mb-2 text-xs font-medium text-slate-400">Activity</h4>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
        {events.map((e) => (
          <li key={e.id} className="flex gap-2 text-xs">
            <span className="shrink-0 text-slate-600">{e.timestamp}</span>
            <span className="shrink-0 text-slate-500">
              {levelIcon[e.level ?? "info"] ?? "○"}
            </span>
            <span className="text-slate-300">{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

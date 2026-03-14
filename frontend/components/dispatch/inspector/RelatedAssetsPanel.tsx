"use client";

import type { RelatedAsset } from "@/lib/dispatch/graphTypes";

export interface RelatedAssetsPanelProps {
  assets: RelatedAsset[];
}

export function RelatedAssetsPanel({ assets }: RelatedAssetsPanelProps) {
  if (assets.length === 0) return null;
  return (
    <div className="rounded-lg border border-dispatch-muted bg-dispatch-slate/30 p-3">
      <h4 className="mb-2 text-xs font-medium text-slate-400">Related</h4>
      <div className="flex flex-wrap gap-1.5">
        {assets.map((a) =>
          a.href ? (
            <a
              key={a.id}
              href={a.href}
              className="rounded-md border border-dispatch-muted bg-dispatch-slate px-2 py-1 text-xs text-slate-300 hover:bg-dispatch-muted hover:text-slate-100"
            >
              {a.label}
            </a>
          ) : (
            <span
              key={a.id}
              className="rounded-md border border-dispatch-muted bg-dispatch-slate px-2 py-1 text-xs text-slate-300"
            >
              {a.label}
            </span>
          )
        )}
      </div>
    </div>
  );
}

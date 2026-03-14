"use client";

export interface MiniMapProps {
  width?: number;
  height?: number;
  className?: string;
}

export function MiniMap({
  width = 120,
  height = 80,
  className = "",
}: MiniMapProps) {
  return (
    <div
      className={`rounded border border-dispatch-muted bg-dispatch-slate/80 ${className}`}
      style={{ width, height }}
    >
      <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
        Mini map
      </div>
    </div>
  );
}

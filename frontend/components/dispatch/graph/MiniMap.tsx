"use client";

import { Map } from "lucide-react";

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
      className={`rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur-sm ${className}`}
      style={{ width, height }}
    >
      <div className="flex h-full flex-col items-center justify-center gap-1">
        <Map className="size-3.5 text-muted-foreground/60" />
        <span className="text-[9px] text-muted-foreground/60">Mini map</span>
      </div>
    </div>
  );
}

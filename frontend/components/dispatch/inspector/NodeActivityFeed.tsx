"use client";

import type { NodeEvent } from "@/lib/dispatch/graphTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NodeActivityFeedProps {
  events: NodeEvent[];
}

const levelConfig: Record<string, { Icon: React.ElementType; className: string }> = {
  info: { Icon: Info, className: "text-muted-foreground" },
  warn: { Icon: AlertTriangle, className: "text-dispatch-orange" },
  error: { Icon: XCircle, className: "text-dispatch-red" },
  success: { Icon: CheckCircle2, className: "text-dispatch-green" },
};

export function NodeActivityFeed({ events }: NodeActivityFeedProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {events.map((e) => {
              const config = levelConfig[e.level ?? "info"] ?? levelConfig.info;
              const { Icon } = config;
              return (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                    {e.timestamp}
                  </span>
                  <Icon className={cn("mt-0.5 size-3 shrink-0", config.className)} />
                  <span className="text-foreground/80">{e.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Map,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  Users,
  Route,
} from "lucide-react";
import type { PreReconDeliverable, TaskAssignment } from "@/lib/dispatch/graphTypes";

interface OrchestratorInspectorProps {
  preRecon: PreReconDeliverable | null;
  taskAssignments: TaskAssignment[];
}

export function OrchestratorInspector({ preRecon, taskAssignments }: OrchestratorInspectorProps) {
  const [risksExpanded, setRisksExpanded] = useState(false);

  if (!preRecon) {
    return (
      <div className="text-xs text-muted-foreground">
        Pre-recon data not yet available.
      </div>
    );
  }

  const routeCount = preRecon.route_map.length;
  const riskCount = preRecon.risk_signals.length;
  const workerCount = taskAssignments.length;

  return (
    <div className="space-y-3">
      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Route} label="Routes" value={routeCount} />
        <StatCard icon={AlertTriangle} label="Risks" value={riskCount} />
        <StatCard icon={Users} label="Workers" value={workerCount} />
      </div>

      {/* Route Map */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Map className="w-3 h-3" />
            Route Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {preRecon.route_map.map((route, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs font-mono bg-muted/30 rounded px-2 py-1.5"
              >
                <Badge variant="outline" className="text-[9px] shrink-0 font-mono">
                  {route.method}
                </Badge>
                <div className="min-w-0">
                  <div className="text-foreground truncate">{route.endpoint}</div>
                  <div className="text-muted-foreground text-[10px] truncate">
                    {route.handler_file}:{route.handler_line}
                  </div>
                  {route.middleware.length > 0 && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {route.middleware.map((mw) => (
                        <Badge key={mw} variant="secondary" className="text-[8px] px-1 py-0">
                          {mw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Signals */}
      <Card size="sm" className="border-status-warning/30 bg-status-warning/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium text-status-warning uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Risk Signals ({riskCount})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRisksExpanded(!risksExpanded)}
              className="h-5 px-1"
            >
              {risksExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </Button>
          </div>
        </CardHeader>
        {risksExpanded && (
          <CardContent>
            <div className="space-y-2">
              {preRecon.risk_signals.map((signal, i) => (
                <div key={i} className="text-xs bg-muted/30 rounded p-2 space-y-1">
                  <div className="font-mono text-foreground">
                    {signal.file}:{signal.line}
                  </div>
                  <div className="text-muted-foreground">{signal.pattern}</div>
                  <pre className="text-[10px] font-mono text-foreground/70 bg-muted/50 rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
                    {signal.snippet}
                  </pre>
                  <div className="flex gap-1 flex-wrap">
                    {signal.suggested_attack_types.map((at) => (
                      <Badge key={at} variant="outline" className="text-[8px] text-status-warning border-status-warning/30">
                        {at}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Briefing Notes */}
      {preRecon.briefing_notes && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Briefing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {preRecon.briefing_notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-2 py-2 text-center">
      <Icon className="mx-auto size-3.5 text-muted-foreground mb-1" />
      <div className="text-sm font-semibold text-foreground">{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

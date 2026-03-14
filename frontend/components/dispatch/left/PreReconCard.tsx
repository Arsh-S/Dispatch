"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Route,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Database,
  Shield,
  FileCode,
} from "lucide-react";
import type { PreReconDeliverable } from "@/lib/dispatch/graphTypes";

export interface PreReconCardProps {
  preRecon: PreReconDeliverable | null;
}

export function PreReconCard({ preRecon }: PreReconCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!preRecon) return null;

  return (
    <Card size="sm" className="border-dispatch-purple/30 bg-dispatch-purple/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-dispatch-purple uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Pre-Recon Results
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
            <Route className="w-3 h-3 text-blue-400" />
            <div>
              <div className="text-xs font-medium">{preRecon.route_map.length}</div>
              <div className="text-[10px] text-muted-foreground">Routes</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            <div>
              <div className="text-xs font-medium">{preRecon.risk_signals.length}</div>
              <div className="text-[10px] text-muted-foreground">Risk Signals</div>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-dispatch-purple/20">
            {/* Risk Signals */}
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Risk Signals
              </div>
              <ul className="space-y-1.5">
                {preRecon.risk_signals.map((signal, i) => (
                  <li key={i} className="text-xs bg-orange-500/10 rounded px-2 py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-orange-400">{signal.pattern}</span>
                      <div className="flex gap-1">
                        {signal.suggested_attack_types.map((type) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="text-[9px] px-1 py-0"
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {signal.file}:{signal.line}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Route Map Preview */}
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Route className="w-3 h-3" />
                Routes
              </div>
              <ul className="space-y-1 max-h-24 overflow-y-auto">
                {preRecon.route_map.map((route, i) => (
                  <li key={i} className="text-xs flex items-center justify-between bg-black/20 rounded px-2 py-1">
                    <span className="font-mono text-blue-400">{route.endpoint}</span>
                    <div className="flex gap-1">
                      {route.middleware.length === 0 ? (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">
                          no auth
                        </Badge>
                      ) : (
                        route.middleware.map((mw) => (
                          <Badge
                            key={mw}
                            variant="outline"
                            className="text-[9px] px-1 py-0"
                          >
                            {mw}
                          </Badge>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dependency Graph */}
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3" />
                Dependencies
              </div>
              <div className="text-xs bg-black/20 rounded px-2 py-1.5 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DB Layer:</span>
                  <span className="font-mono text-foreground">{preRecon.dependency_graph.db_layer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ORM:</span>
                  <span className="font-mono text-foreground text-right max-w-[150px] truncate">{preRecon.dependency_graph.orm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auth:</span>
                  <span className="font-mono text-foreground">{preRecon.dependency_graph.auth_middleware}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="font-mono text-foreground text-right max-w-[150px] truncate">{preRecon.dependency_graph.session_store}</span>
                </div>
              </div>
            </div>

            {/* Briefing Notes */}
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <FileCode className="w-3 h-3" />
                Briefing
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {preRecon.briefing_notes}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

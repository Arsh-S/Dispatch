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
    <Card size="sm" className="ring-primary">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Pre-Recon Results
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
            <Route className="w-4 h-4 text-primary" />
            <div>
              <div className="text-sm font-medium">{preRecon.route_map.length}</div>
              <div className="text-xs text-muted-foreground">Routes</div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <div>
              <div className="text-sm font-medium">{preRecon.risk_signals.length}</div>
              <div className="text-xs text-muted-foreground">Risk Signals</div>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-1.5 pt-1">
            {/* Risk Signals */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Risk Signals
              </div>
              <ul className="space-y-1">
                {preRecon.risk_signals.map((signal, i) => (
                  <li key={i} className="text-base bg-destructive/10 rounded-md px-2 py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-destructive text-sm sm:text-[15px]">
                        {signal.pattern}
                      </span>
                      <div className="flex gap-1.5">
                        {signal.suggested_attack_types.map((type) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="text-[11px] px-1.5 py-0.5 leading-none"
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {signal.file}:{signal.line}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Route Map Preview */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Route className="w-4 h-4" />
                Routes
              </div>
              <ul className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {preRecon.route_map.map((route, i) => (
                  <li
                    key={i}
                    className="text-base flex items-center justify-between bg-muted/50 rounded-md px-2 py-1"
                  >
                    <span className="font-mono text-primary text-sm sm:text-[15px]">
                      {route.endpoint}
                    </span>
                    <div className="flex gap-1.5">
                      {route.middleware.length === 0 ? (
                        <Badge className="text-[11px] px-1.5 py-0.5 leading-none bg-destructive/20 text-destructive border-destructive/30">
                          no auth
                        </Badge>
                      ) : (
                        route.middleware.map((mw) => (
                          <Badge
                            key={mw}
                            variant="outline"
                            className="text-[11px] px-1.5 py-0.5 leading-none"
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
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                Dependencies
              </div>
              <div className="text-base bg-muted/50 rounded-md px-2 py-1.5 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DB Layer:</span>
                  <span className="font-mono text-foreground text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.db_layer}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ORM:</span>
                  <span className="font-mono text-foreground text-right max-w-[220px] truncate text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.orm}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auth:</span>
                  <span className="font-mono text-foreground text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.auth_middleware}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="font-mono text-foreground text-right max-w-[220px] truncate text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.session_store}
                  </span>
                </div>
              </div>
            </div>

            {/* Briefing Notes */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-4 h-4" />
                Briefing
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {preRecon.briefing_notes}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

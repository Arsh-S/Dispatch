"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Wrench,
} from "lucide-react";
import type { Finding, Severity } from "@/lib/dispatch/graphTypes";

export interface FindingsListCardProps {
  findings: Finding[];
  onSelectFinding: (findingId: string) => void;
}

function getSeverityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "bg-status-error/20 text-status-error border-status-error/30";
    case "HIGH":
      return "bg-status-warning/20 text-status-warning border-status-warning/30";
    case "MEDIUM":
      return "bg-status-running/20 text-status-running border-status-running/30";
    case "LOW":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getSeverityIcon(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return <AlertTriangle className="w-3 h-3" />;
    default:
      return <AlertTriangle className="w-3 h-3" />;
  }
}

function getFixStatusIcon(status?: string) {
  switch (status) {
    case "verified":
      return <CheckCircle className="w-3 h-3 text-primary" />;
    case "in-progress":
      return <Wrench className="w-3 h-3 text-status-info" />;
    case "failed":
      return <XCircle className="w-3 h-3 text-status-error" />;
    default:
      return <Clock className="w-3 h-3 text-muted-foreground" />;
  }
}

export function FindingsListCard({ findings, onSelectFinding }: FindingsListCardProps) {
  if (findings.length === 0) return null;

  // Sort by severity: CRITICAL > HIGH > MEDIUM > LOW
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedFindings = [...findings].sort(
    (a, b) =>
      (severityOrder[a.severity as keyof typeof severityOrder] || 4) -
      (severityOrder[b.severity as keyof typeof severityOrder] || 4)
  );

  return (
    <Card size="sm" className="border-status-error/30 bg-status-error/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-status-error uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Findings ({findings.length})
          </CardTitle>
          <div className="flex gap-1 text-[9px]">
            <Badge className="bg-status-error/20 text-status-error border-status-error/30 px-1 py-0">
              {findings.filter((f) => f.severity === "CRITICAL").length} CRIT
            </Badge>
            <Badge className="bg-status-warning/20 text-status-warning border-status-warning/30 px-1 py-0">
              {findings.filter((f) => f.severity === "HIGH").length} HIGH
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-48">
          <ul className="divide-y divide-border/50">
            {sortedFindings.map((finding) => (
              <li
                key={finding.finding_id}
                onClick={() => onSelectFinding(finding.finding_id)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <Badge className={`${getSeverityColor(finding.severity)} text-[9px] px-1.5 py-0 shrink-0`}>
                  {finding.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {finding.vuln_type.replace(/-/g, " ")}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {finding.location.endpoint}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <span title={finding.exploit_confidence === "confirmed" ? "Confirmed" : "Unconfirmed"}>
                    {finding.exploit_confidence === "confirmed" ? (
                      <CheckCircle className="w-3 h-3 text-primary" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-status-running" />
                    )}
                  </span>
                  {getFixStatusIcon(finding.fix_status)}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

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
import type { Finding } from "@/lib/dispatch/graphTypes";

export interface FindingsListCardProps {
  findings: Finding[];
  onSelectFinding: (findingId: string) => void;
}

function getSeverityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "MEDIUM":
      return "bg-muted text-muted-foreground border-border";
    case "LOW":
    default:
      return "bg-muted/50 text-muted-foreground border-border";
  }
}

function getFixStatusIcon(status?: string) {
  switch (status) {
    case "verified":
      return <CheckCircle className="w-3 h-3 text-primary" />;
    case "in-progress":
      return <Wrench className="w-3 h-3 text-primary" />;
    case "failed":
      return <XCircle className="w-3 h-3 text-destructive" />;
    default:
      return <Clock className="w-3 h-3 text-muted-foreground" />;
  }
}

export function FindingsListCard({ findings, onSelectFinding }: FindingsListCardProps) {
  if (findings.length === 0) return null;

  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedFindings = [...findings].sort(
    (a, b) =>
      (severityOrder[a.severity as keyof typeof severityOrder] || 4) -
      (severityOrder[b.severity as keyof typeof severityOrder] || 4)
  );

  return (
    <Card size="sm" className="ring-destructive bg-destructive/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-destructive uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Findings ({findings.length})
          </CardTitle>
          <div className="flex gap-1 text-[9px]">
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 px-1 py-0">
              {findings.filter((f) => f.severity === "CRITICAL").length} CRIT
            </Badge>
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 px-1 py-0">
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
                className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
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
                      <AlertTriangle className="w-3 h-3 text-muted-foreground" />
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

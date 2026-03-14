"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/dispatch/common/SeverityBadge";
import {
  FileText,
  Target,
  Swords,
  Clock,
  CheckCircle,
  ShieldCheck,
  Bug,
} from "lucide-react";
import type {
  TaskAssignment,
  FindingReport,
  Severity,
} from "@/lib/dispatch/graphTypes";

interface WorkerInspectorProps {
  assignment?: TaskAssignment;
  report?: FindingReport;
}

export function WorkerInspector({ assignment, report }: WorkerInspectorProps) {
  if (!assignment && !report) {
    return (
      <div className="text-xs text-muted-foreground">
        No assignment or report data available for this worker.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Assignment Details */}
      {assignment && (
        <>
          {/* Attack type + target */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Target className="w-3 h-3" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <dl className="space-y-1.5 text-xs">
                <Row label="Attack Type">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {assignment.attack_type}
                  </Badge>
                </Row>
                <Row label="Endpoint">
                  <span className="font-mono text-primary">
                    {assignment.target.method} {assignment.target.endpoint}
                  </span>
                </Row>
                <Row label="File">
                  <span className="font-mono text-foreground/80">
                    {assignment.target.file}
                    {assignment.target.line_range && `:${assignment.target.line_range[0]}-${assignment.target.line_range[1]}`}
                  </span>
                </Row>
                {assignment.target.parameters.length > 0 && (
                  <Row label="Params">
                    <div className="flex gap-1 flex-wrap">
                      {assignment.target.parameters.map((p) => (
                        <Badge key={p} variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </Row>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Briefing */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Briefing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {assignment.briefing}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Report */}
      {report && (
        <Card size="sm" className={
          report.status === "completed"
            ? "border-primary/30 bg-primary/5"
            : "border-status-error/30 bg-status-error/5"
        }>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Swords className="w-3 h-3" />
              Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <dl className="space-y-1.5 text-xs">
              <Row label="Status">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    report.status === "completed"
                      ? "text-primary border-primary/30"
                      : "text-status-error border-status-error/30"
                  }`}
                >
                  {report.status}
                </Badge>
              </Row>
              <Row label="Duration">
                <span className="flex items-center gap-1 text-foreground/80">
                  <Clock className="size-3" />
                  {formatSeconds(report.duration_seconds)}
                </span>
              </Row>
              <Row label="Findings">
                <span className="flex items-center gap-1">
                  <Bug className="size-3 text-status-error" />
                  <span className="font-medium text-foreground">{report.findings.length}</span>
                </span>
              </Row>
              <Row label="Clean">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3 text-primary" />
                  <span className="font-medium text-foreground">{report.clean_endpoints.length}</span>
                </span>
              </Row>
            </dl>

            {/* Findings summary */}
            {report.findings.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Findings</div>
                {report.findings.map((f) => (
                  <div key={f.finding_id} className="flex items-center justify-between gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                    <span className="font-mono truncate text-foreground/80">{f.vuln_type}</span>
                    <SeverityBadge severity={f.severity.toLowerCase() as Severity} />
                  </div>
                ))}
              </div>
            )}

            {/* Clean endpoints */}
            {report.clean_endpoints.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Clean Endpoints</div>
                {report.clean_endpoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-foreground/70">
                    <CheckCircle className="size-3 text-primary shrink-0" />
                    <span className="font-mono truncate">{ep.endpoint}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Worker notes */}
            {report.worker_notes && (
              <div className="pt-2 border-t border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notes</div>
                <p className="text-xs text-foreground/70">{report.worker_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right min-w-0">{children}</dd>
    </div>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

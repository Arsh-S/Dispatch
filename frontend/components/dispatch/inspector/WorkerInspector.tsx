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
  Activity,
  AlertTriangle,
  Repeat,
} from "lucide-react";
import type {
  AgentDiagnostics,
  HealthStatus,
  TaskAssignment,
  FindingReport,
  Severity,
} from "@/lib/dispatch/graphTypes";

interface WorkerInspectorProps {
  assignment?: TaskAssignment;
  report?: FindingReport;
  diagnostics?: AgentDiagnostics;
  healthStatus?: HealthStatus;
}

export function WorkerInspector({ assignment, report, diagnostics, healthStatus }: WorkerInspectorProps) {
  if (!assignment && !report && !diagnostics) {
    return (
      <div className="text-xs text-muted-foreground">
        No assignment or report data available for this worker.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Diagnostics / Health Panel */}
      {diagnostics && (
        <Card size="sm" className={
          healthStatus === "looping"
            ? "border-red-500/30 bg-red-500/5"
            : healthStatus === "warning"
            ? "border-amber-400/30 bg-amber-400/5"
            : "border-primary/30 bg-primary/5"
        }>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Diagnostics
              {healthStatus && (
                <HealthBadge status={healthStatus} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <dl className="space-y-1.5 text-xs">
              <Row label="Phase">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {diagnostics.phase}
                </Badge>
              </Row>
              <Row label="Wall Clock">
                <span className="flex items-center gap-1 text-foreground/80">
                  <Clock className="size-3" />
                  {formatSeconds(diagnostics.wall_clock_seconds)}
                </span>
              </Row>
              <Row label="Trace Length">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {diagnostics.trace_length}
                  </span>
                  <TraceBar value={diagnostics.trace_length} max={200} />
                </div>
              </Row>
              <Row label="Tool Calls">
                <span className="font-medium text-foreground">{diagnostics.total_tool_calls}</span>
              </Row>
              <Row label="Repeated">
                <span className="flex items-center gap-1">
                  <Repeat className="size-3 text-amber-400" />
                  <span className="font-medium text-foreground">{diagnostics.repeated_calls}</span>
                </span>
              </Row>
              <Row label="Errors">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="size-3 text-status-error" />
                  <span className="font-medium text-foreground">
                    {diagnostics.error_count}
                    {diagnostics.consecutive_errors > 0 && (
                      <span className="text-status-error ml-1">
                        ({diagnostics.consecutive_errors} consecutive)
                      </span>
                    )}
                  </span>
                </span>
              </Row>
              <Row label="Findings">
                <span className="font-medium text-foreground">{diagnostics.findings_so_far}</span>
              </Row>
              <Row label="Lines">
                <span className="text-foreground/80">
                  <span className="text-primary">+{diagnostics.lines_added}</span>
                  {" / "}
                  <span className="text-status-error">-{diagnostics.lines_removed}</span>
                </span>
              </Row>
              <Row label="Files">
                <span className="font-medium text-foreground">{diagnostics.unique_files_touched.length}</span>
              </Row>
            </dl>

            {/* Tool call breakdown */}
            {Object.keys(diagnostics.tool_calls).length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tool Call Breakdown</div>
                {Object.entries(diagnostics.tool_calls)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tool, count]) => (
                    <div key={tool} className="flex items-center justify-between gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                      <span className="font-mono truncate text-foreground/80">{tool}</span>
                      <span className="font-medium text-foreground shrink-0">{count}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Last action */}
            {diagnostics.last_action && (
              <div className="pt-2 border-t border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last Action</div>
                <p className="text-xs text-foreground/70">{diagnostics.last_action}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

function HealthBadge({ status }: { status: HealthStatus }) {
  const styles: Record<HealthStatus, string> = {
    healthy: "bg-primary/10 text-primary border-primary/20",
    warning: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    looping: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${styles[status]}`}>
      {status}
    </Badge>
  );
}

function TraceBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 70 ? "bg-red-500" : pct > 40 ? "bg-amber-400" : "bg-primary";

  return (
    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
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

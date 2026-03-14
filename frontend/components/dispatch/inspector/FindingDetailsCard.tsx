"use client";

import { SeverityBadge } from "@/components/dispatch/common/SeverityBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Severity } from "@/lib/dispatch/graphTypes";

export interface FindingDetailsCardProps {
  severity: Severity;
  endpoint?: string;
  filePath?: string;
  lineNumber?: number;
  exploitSummary?: string;
  remediation?: string;
  ticketStatus?: string;
  fixVerificationStatus?: string;
}

export function FindingDetailsCard({
  severity,
  endpoint,
  filePath,
  lineNumber,
  exploitSummary,
  remediation,
  ticketStatus,
  fixVerificationStatus,
}: FindingDetailsCardProps) {
  return (
    <Card size="sm" className="border-dispatch-red/30 ring-dispatch-red/10">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-dispatch-red uppercase tracking-wider">
          Finding Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Severity</dt>
            <dd><SeverityBadge severity={severity} /></dd>
          </div>
          {endpoint != null && (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-muted-foreground">Endpoint</dt>
              <dd className="font-mono text-foreground">{endpoint}</dd>
            </div>
          )}
          {filePath != null && (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-muted-foreground">File</dt>
              <dd className="font-mono text-foreground">
                {filePath}{lineNumber != null && `:${lineNumber}`}
              </dd>
            </div>
          )}
          {exploitSummary != null && (
            <div>
              <dt className="mb-0.5 text-muted-foreground">Exploit / repro</dt>
              <dd className="text-foreground/80">{exploitSummary}</dd>
            </div>
          )}
          {remediation != null && (
            <div>
              <dt className="mb-0.5 text-muted-foreground">Remediation</dt>
              <dd className="text-foreground/80">{remediation}</dd>
            </div>
          )}
          {ticketStatus != null && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Ticket</dt>
              <dd className="text-foreground">{ticketStatus}</dd>
            </div>
          )}
          {fixVerificationStatus != null && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Fix verification</dt>
              <dd className="text-foreground">{fixVerificationStatus}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

"use client";

import { SeverityBadge } from "@/components/dispatch/common/SeverityBadge";
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
    <div className="rounded-lg border border-dispatch-red/30 bg-dispatch-red/5 p-3">
      <h4 className="mb-2 text-xs font-medium text-slate-400">Finding details</h4>
      <dl className="space-y-1.5 text-xs">
        <div>
          <dt className="text-slate-500">Severity</dt>
          <dd>
            <SeverityBadge severity={severity} />
          </dd>
        </div>
        {endpoint != null && (
          <div>
            <dt className="text-slate-500">Endpoint</dt>
            <dd className="font-mono text-slate-200">{endpoint}</dd>
          </div>
        )}
        {filePath != null && (
          <div>
            <dt className="text-slate-500">File</dt>
            <dd className="font-mono text-slate-200">
              {filePath}
              {lineNumber != null && `:${lineNumber}`}
            </dd>
          </div>
        )}
        {exploitSummary != null && (
          <div>
            <dt className="text-slate-500">Exploit / repro</dt>
            <dd className="text-slate-200">{exploitSummary}</dd>
          </div>
        )}
        {remediation != null && (
          <div>
            <dt className="text-slate-500">Remediation</dt>
            <dd className="text-slate-200">{remediation}</dd>
          </div>
        )}
        {ticketStatus != null && (
          <div>
            <dt className="text-slate-500">Ticket</dt>
            <dd className="text-slate-200">{ticketStatus}</dd>
          </div>
        )}
        {fixVerificationStatus != null && (
          <div>
            <dt className="text-slate-500">Fix verification</dt>
            <dd className="text-slate-200">{fixVerificationStatus}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

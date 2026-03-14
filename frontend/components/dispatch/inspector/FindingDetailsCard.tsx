"use client";

import { useState } from "react";
import { SeverityBadge } from "@/components/dispatch/common/SeverityBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileCode,
  Terminal,
  GitBranch,
  Wrench,
} from "lucide-react";
import type {
  Finding,
  Severity,
  ExploitConfidence,
  MonkeypatchStatus,
  FixStatus,
} from "@/lib/dispatch/graphTypes";

export interface FindingDetailsCardProps {
  finding: Finding;
}

function ExploitConfidenceBadge({ confidence }: { confidence: ExploitConfidence }) {
  if (confidence === "confirmed") {
    return (
      <Badge className="text-[10px] gap-1 bg-primary/20 text-primary border-primary/30">
        <CheckCircle className="w-3 h-3" />
        Confirmed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] gap-1">
      <AlertTriangle className="w-3 h-3" />
      Unconfirmed
    </Badge>
  );
}

function MonkeypatchBadge({ status }: { status: MonkeypatchStatus }) {
  switch (status) {
    case "validated":
      return (
        <Badge className="text-[10px] gap-1 bg-primary/20 text-primary border-primary/30">
          <CheckCircle className="w-3 h-3" />
          Validated
        </Badge>
      );
    case "failed":
      return (
        <Badge className="text-[10px] gap-1 bg-destructive/20 text-destructive border-destructive/30">
          <XCircle className="w-3 h-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Clock className="w-3 h-3" />
          Not Attempted
        </Badge>
      );
  }
}

function FixStatusBadge({ status }: { status?: FixStatus }) {
  switch (status) {
    case "verified":
      return (
        <Badge className="text-[10px] gap-1 bg-primary/20 text-primary border-primary/30">
          <CheckCircle className="w-3 h-3" />
          Fix Verified
        </Badge>
      );
    case "in-progress":
      return (
        <Badge className="text-[10px] gap-1 bg-primary/20 text-primary border-primary/30">
          <Wrench className="w-3 h-3" />
          In Progress
        </Badge>
      );
    case "unverified":
      return (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <AlertTriangle className="w-3 h-3" />
          Unverified
        </Badge>
      );
    case "failed":
      return (
        <Badge className="text-[10px] gap-1 bg-destructive/20 text-destructive border-destructive/30">
          <XCircle className="w-3 h-3" />
          Fix Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Clock className="w-3 h-3" />
          Unfixed
        </Badge>
      );
  }
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 px-2 text-[10px] gap-1"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {label || "Copy"}
        </>
      )}
    </Button>
  );
}

export function FindingDetailsCard({ finding }: FindingDetailsCardProps) {
  const [showFullDiff, setShowFullDiff] = useState(false);

  const isHighSeverity = finding.severity === "CRITICAL" || finding.severity === "HIGH";
  const cardBorder = isHighSeverity ? "ring-destructive/30" : "ring-border";

  return (
    <div className="space-y-3">
      {/* Main Finding Card */}
      <Card size="sm" className={cardBorder}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {finding.vuln_type.replace(/-/g, " ").toUpperCase()}
            </CardTitle>
            <SeverityBadge severity={finding.severity.toLowerCase() as Severity} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Location */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider">
              <FileCode className="w-3 h-3" />
              Location
            </div>
            <div className="font-mono text-xs bg-muted/50 rounded-md px-2 py-1.5 space-y-0.5">
              <div className="text-foreground">
                {finding.location.file}:{finding.location.line}
              </div>
              <div className="text-primary">
                {finding.location.method} {finding.location.endpoint}
              </div>
              {finding.location.parameter && (
                <div className="text-muted-foreground">
                  Parameter: <span className="text-foreground">{finding.location.parameter}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-1.5">
            <ExploitConfidenceBadge confidence={finding.exploit_confidence} />
            <MonkeypatchBadge status={finding.monkeypatch.status} />
            <FixStatusBadge status={finding.fix_status} />
          </div>

          {/* Metadata */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {finding.cvss_score && (
              <>
                <dt className="text-muted-foreground">CVSS Score</dt>
                <dd className="text-foreground font-medium">{finding.cvss_score}</dd>
              </>
            )}
            {finding.owasp && (
              <>
                <dt className="text-muted-foreground">OWASP</dt>
                <dd className="text-foreground font-mono">{finding.owasp}</dd>
              </>
            )}
          </dl>

          {/* Description */}
          <div className="space-y-1">
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Description
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {finding.description}
            </p>
          </div>

          {/* Rules Violated */}
          {finding.rules_violated.length > 0 && (
            <div className="space-y-1">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Rules Violated
              </div>
              <ul className="space-y-0.5">
                {finding.rules_violated.map((rule, i) => (
                  <li key={i} className="text-xs text-destructive flex items-start gap-1.5">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* GitHub Issue Link */}
          {finding.github_issue_url && (
            <a
              href={finding.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <GitBranch className="w-3 h-3" />
              Issue #{finding.github_issue_number}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </CardContent>
      </Card>

      {/* Reproduction Card */}
      {finding.reproduction && (
        <Card size="sm" className="ring-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" />
                Reproduction
              </CardTitle>
              <CopyButton text={finding.reproduction.command} label="Copy curl" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Steps */}
            <div className="space-y-1">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Steps
              </div>
              <ol className="space-y-1 list-decimal list-inside">
                {finding.reproduction.steps.map((step, i) => (
                  <li key={i} className="text-xs text-foreground/80">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Command */}
            <div className="space-y-1">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Command
              </div>
              <pre className="font-mono text-[10px] bg-muted/50 rounded-md p-2 overflow-x-auto text-primary whitespace-pre-wrap break-all">
                {finding.reproduction.command}
              </pre>
            </div>

            {/* Expected vs Actual */}
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-primary" />
                  Expected
                </div>
                <div className="text-xs text-foreground/80 bg-primary/10 rounded-md px-2 py-1">
                  {finding.reproduction.expected}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-destructive" />
                  Actual
                </div>
                <div className="text-xs text-foreground/80 bg-destructive/10 rounded-md px-2 py-1">
                  {finding.reproduction.actual}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Server Logs Card */}
      {finding.server_logs.length > 0 && (
        <Card size="sm" className="ring-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" />
              Server Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-[10px] bg-muted/50 rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
              {finding.server_logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={
                      log.level === "ERROR"
                        ? "text-destructive"
                        : log.level === "WARN"
                        ? "text-muted-foreground"
                        : "text-foreground/70"
                    }
                  >
                    [{log.level}]
                  </span>
                  <span className="text-foreground/80">{log.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monkeypatch Card */}
      {finding.monkeypatch.diff && (
        <Card size="sm" className="ring-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5" />
                Monkeypatch
              </CardTitle>
              <MonkeypatchBadge status={finding.monkeypatch.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <pre className={`font-mono text-[10px] bg-muted/50 rounded-md p-2 overflow-x-auto ${showFullDiff ? "" : "max-h-24"}`}>
              {finding.monkeypatch.diff.split("\n").map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith("+")
                      ? "text-primary"
                      : line.startsWith("-")
                      ? "text-destructive"
                      : line.startsWith("@@")
                      ? "text-muted-foreground"
                      : "text-foreground/60"
                  }
                >
                  {line}
                </div>
              ))}
            </pre>
            {finding.monkeypatch.diff.split("\n").length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullDiff(!showFullDiff)}
                className="h-6 text-[10px] w-full"
              >
                {showFullDiff ? "Show less" : "Show full diff"}
              </Button>
            )}

            {/* Validation result */}
            {finding.monkeypatch.validation && (
              <div className="space-y-1 pt-2">
                <div className="text-muted-foreground text-xs uppercase tracking-wider">
                  Validation
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Test:</span>
                    <span className="text-foreground/80">{finding.monkeypatch.validation.test}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Result:</span>
                    <Badge
                      className={
                        finding.monkeypatch.validation.result === "PASS"
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-destructive/20 text-destructive border-destructive/30"
                      }
                    >
                      {finding.monkeypatch.validation.result}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Response:</span>
                    <span className="text-foreground/80">{finding.monkeypatch.validation.response}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommended Fix Card */}
      <Card size="sm" className="ring-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5" />
            Recommended Fix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {finding.recommended_fix}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

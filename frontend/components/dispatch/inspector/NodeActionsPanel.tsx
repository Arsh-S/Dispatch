"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCcw,
  Focus,
  Ticket,
  Wrench,
  Expand,
  Code,
  ExternalLink,
  GitPullRequest,
  Bug,
  Play,
} from "lucide-react";
import type { Finding } from "@/lib/dispatch/graphTypes";

export interface NodeActionsPanelProps {
  finding?: Finding;
  onRerun?: () => void;
  onIsolateCluster?: () => void;
  onCreateTicket?: () => void;
  onAssignFixer?: () => void;
  onExpandRelated?: () => void;
  onJumpToCode?: () => void;
  onOpenLinked?: () => void;
  onTriggerFix?: () => void;
}

interface Action {
  label: string;
  onClick: (() => void) | undefined;
  Icon: React.ElementType;
  variant?: "default" | "outline";
  description?: string;
}

export function NodeActionsPanel({
  finding,
  onRerun,
  onIsolateCluster,
  onCreateTicket,
  onAssignFixer,
  onExpandRelated,
  onJumpToCode,
  onOpenLinked,
  onTriggerFix,
}: NodeActionsPanelProps) {
  // Build actions based on context
  const actions: Action[] = [];

  // Finding-specific actions
  if (finding) {
    // Trigger fix (construction worker)
    if (finding.fix_status === "unfixed" || finding.fix_status === undefined) {
      actions.push({
        label: "Trigger Fix",
        onClick: onTriggerFix || (() => console.log("Trigger fix for:", finding.finding_id)),
        Icon: Wrench,
        variant: "default",
        description: "Deploy construction worker",
      });
    }

    // View GitHub Issue
    if (finding.github_issue_url) {
      actions.push({
        label: `View Issue #${finding.github_issue_number}`,
        onClick: () => window.open(finding.github_issue_url, "_blank"),
        Icon: Bug,
      });
    }

    // View PR
    if (finding.pr_url) {
      actions.push({
        label: `View PR #${finding.pr_number}`,
        onClick: () => window.open(finding.pr_url, "_blank"),
        Icon: GitPullRequest,
      });
    }

    // Jump to code
    actions.push({
      label: "Jump to Code",
      onClick: onJumpToCode || (() => console.log("Jump to:", finding.location.file, finding.location.line)),
      Icon: Code,
      description: `${finding.location.file}:${finding.location.line}`,
    });

    // Retest
    if (finding.fix_status === "verified" || finding.fix_status === "unverified") {
      actions.push({
        label: "Retest Finding",
        onClick: onRerun || (() => console.log("Retest:", finding.finding_id)),
        Icon: Play,
      });
    }

    // Re-run attack
    if (finding.exploit_confidence === "unconfirmed") {
      actions.push({
        label: "Retry Exploit",
        onClick: onRerun || (() => console.log("Retry exploit:", finding.finding_id)),
        Icon: RefreshCcw,
      });
    }
  } else {
    // Non-finding node actions
    const baseActions: Action[] = [
      { label: "Re-run node", onClick: onRerun, Icon: RefreshCcw },
      { label: "Isolate cluster", onClick: onIsolateCluster, Icon: Focus },
      { label: "Create ticket", onClick: onCreateTicket, Icon: Ticket },
      { label: "Assign fixer", onClick: onAssignFixer, Icon: Wrench },
      { label: "Expand related", onClick: onExpandRelated, Icon: Expand },
      { label: "Jump to code", onClick: onJumpToCode, Icon: Code },
      { label: "Open linked", onClick: onOpenLinked, Icon: ExternalLink },
    ].filter((a) => a.onClick != null);

    actions.push(...baseActions);
  }

  if (actions.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5">
          {actions.map(({ label, onClick, Icon, variant, description }) => (
            <Button
              key={label}
              variant={variant || "outline"}
              size="sm"
              onClick={onClick}
              className={`w-full justify-start gap-2 text-xs ${
                variant === "default" ? "bg-dispatch-purple hover:bg-dispatch-purple/90" : ""
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="flex flex-col items-start">
                <span>{label}</span>
                {description && (
                  <span className="text-[9px] text-muted-foreground font-normal truncate max-w-[150px]">
                    {description}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

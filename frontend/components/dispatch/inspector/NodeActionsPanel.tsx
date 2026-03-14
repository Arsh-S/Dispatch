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
} from "lucide-react";

export interface NodeActionsPanelProps {
  onRerun?: () => void;
  onIsolateCluster?: () => void;
  onCreateTicket?: () => void;
  onAssignFixer?: () => void;
  onExpandRelated?: () => void;
  onJumpToCode?: () => void;
  onOpenLinked?: () => void;
}

export function NodeActionsPanel({
  onRerun,
  onIsolateCluster,
  onCreateTicket,
  onAssignFixer,
  onExpandRelated,
  onJumpToCode,
  onOpenLinked,
}: NodeActionsPanelProps) {
  const actions = [
    { label: "Re-run node", onClick: onRerun, Icon: RefreshCcw },
    { label: "Isolate cluster", onClick: onIsolateCluster, Icon: Focus },
    { label: "Create ticket", onClick: onCreateTicket, Icon: Ticket },
    { label: "Assign fixer", onClick: onAssignFixer, Icon: Wrench },
    { label: "Expand related", onClick: onExpandRelated, Icon: Expand },
    { label: "Jump to code", onClick: onJumpToCode, Icon: Code },
    { label: "Open linked", onClick: onOpenLinked, Icon: ExternalLink },
  ].filter((a) => a.onClick != null);

  if (actions.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          {actions.map(({ label, onClick, Icon }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              onClick={onClick}
              className="w-full justify-start gap-2 text-xs"
            >
              <Icon className="size-3.5" />
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

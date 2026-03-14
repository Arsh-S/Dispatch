"use client";

import { StatusBadge, type StatusVariant } from "@/components/dispatch/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";

export interface RunHeaderProps {
  runName: string;
  environment: string;
  status: string;
  onPrimaryAction: () => void;
}

const statusToVariant: Record<string, StatusVariant> = {
  idle: "idle",
  planning: "planning",
  executing: "executing",
  patching: "fixer",
  retesting: "retest",
  completed: "completed",
};

function primaryButtonConfig(status: string): { label: string; Icon: React.ElementType } {
  switch (status) {
    case "idle":
      return { label: "Launch Dispatch", Icon: Play };
    case "planning":
    case "executing":
    case "patching":
    case "retesting":
      return { label: "Pause Run", Icon: Pause };
    case "completed":
      return { label: "Redeploy + Retest", Icon: RotateCcw };
    default:
      return { label: "Launch Dispatch", Icon: Play };
  }
}

export function RunHeader({
  runName,
  environment,
  status,
  onPrimaryAction,
}: RunHeaderProps) {
  const variant = statusToVariant[status] ?? "idle";
  const { label, Icon } = primaryButtonConfig(status);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">Dispatch</h1>
        <p className="text-xs text-muted-foreground">{runName}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge variant="idle">{environment}</StatusBadge>
        <StatusBadge variant={variant}>{status}</StatusBadge>
      </div>
      <Button
        onClick={onPrimaryAction}
        className="w-full gap-2"
        size="sm"
      >
        <Icon className="size-3.5" />
        {label}
      </Button>
      <Separator />
    </div>
  );
}

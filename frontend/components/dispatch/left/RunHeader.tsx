"use client";

import { StatusBadge, type StatusVariant } from "@/components/dispatch/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  RotateCcw,
  Loader2,
  RefreshCw,
} from "lucide-react";

export interface RunHeaderProps {
  runName: string;
  environment: string;
  status: string;
  onPrimaryAction: () => void;
  isLoading?: boolean;
  lastUpdated?: string | null;
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

function formatLastUpdated(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function RunHeader({
  runName,
  environment,
  status,
  onPrimaryAction,
  isLoading,
  lastUpdated,
}: RunHeaderProps) {
  const variant = statusToVariant[status] ?? "idle";
  const { label, Icon } = primaryButtonConfig(status);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Dispatch</h1>
          <p className="text-xs text-muted-foreground">{runName}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          <span>{formatLastUpdated(lastUpdated)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge variant="idle">{environment}</StatusBadge>
        <StatusBadge variant={variant}>{status}</StatusBadge>
        {isLoading && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            syncing
          </span>
        )}
      </div>
      <Button
        onClick={onPrimaryAction}
        className="w-full gap-2 bg-dispatch-purple hover:bg-dispatch-purple/90"
        size="sm"
      >
        <Icon className="size-3.5" />
        {label}
      </Button>
      <Separator />
    </div>
  );
}

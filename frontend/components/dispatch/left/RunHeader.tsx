"use client";

import { StatusBadge, type StatusVariant } from "@/components/dispatch/common/StatusBadge";

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

function primaryButtonLabel(status: string): string {
  switch (status) {
    case "idle":
      return "Launch Dispatch";
    case "planning":
    case "executing":
    case "patching":
    case "retesting":
      return "Pause Run";
    case "completed":
      return "Redeploy + Retest";
    default:
      return "Launch Dispatch";
  }
}

export function RunHeader({
  runName,
  environment,
  status,
  onPrimaryAction,
}: RunHeaderProps) {
  const variant = statusToVariant[status] ?? "idle";
  return (
    <div className="space-y-3 border-b border-dispatch-muted pb-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Dispatch</h1>
        <p className="text-sm text-slate-400">{runName}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant="idle">{environment}</StatusBadge>
        <StatusBadge variant={variant}>{status}</StatusBadge>
      </div>
      <button
        type="button"
        onClick={onPrimaryAction}
        className="w-full rounded-lg bg-dispatch-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-dispatch-blue/90 focus:outline-none focus:ring-2 focus:ring-dispatch-blue/50"
      >
        {primaryButtonLabel(status)}
      </button>
    </div>
  );
}

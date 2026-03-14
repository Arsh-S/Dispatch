"use client";

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
    { label: "Re-run node", onClick: onRerun },
    { label: "Isolate cluster", onClick: onIsolateCluster },
    { label: "Create ticket", onClick: onCreateTicket },
    { label: "Assign fixer", onClick: onAssignFixer },
    { label: "Expand related nodes", onClick: onExpandRelated },
    { label: "Jump to code", onClick: onJumpToCode },
    { label: "Open linked issue / PR", onClick: onOpenLinked },
  ].filter((a) => a.onClick != null);

  if (actions.length === 0) return null;
  return (
    <div className="rounded-lg border border-dispatch-muted bg-dispatch-slate/30 p-3">
      <h4 className="mb-2 text-xs font-medium text-slate-400">Actions</h4>
      <div className="flex flex-col gap-1.5">
        {actions.map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="rounded border border-dispatch-muted bg-dispatch-slate px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-dispatch-muted hover:text-slate-100"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

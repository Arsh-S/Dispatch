"use client";

export interface LaunchControlsProps {
  status: string;
  onLaunch: () => void;
  onPause?: () => void;
  onAbort?: () => void;
  onRedeployRetest?: () => void;
}

export function LaunchControls({
  status,
  onLaunch,
  onPause,
  onAbort,
  onRedeployRetest,
}: LaunchControlsProps) {
  const isActive =
    status === "planning" ||
    status === "executing" ||
    status === "patching" ||
    status === "retesting";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "idle" && (
        <button
          type="button"
          onClick={onLaunch}
          className="rounded-lg bg-dispatch-blue px-3 py-2 text-sm font-medium text-white hover:bg-dispatch-blue/90"
        >
          Launch Dispatch
        </button>
      )}
      {isActive && (
        <>
          {onPause && (
            <button
              type="button"
              onClick={onPause}
              className="rounded-lg border border-dispatch-yellow/50 bg-dispatch-yellow/10 px-3 py-2 text-sm font-medium text-dispatch-yellow hover:bg-dispatch-yellow/20"
            >
              Pause Run
            </button>
          )}
          {onAbort && (
            <button
              type="button"
              onClick={onAbort}
              className="rounded-lg border border-dispatch-red/50 bg-dispatch-red/10 px-3 py-2 text-sm font-medium text-dispatch-red hover:bg-dispatch-red/20"
            >
              Abort Run
            </button>
          )}
        </>
      )}
      {status === "completed" && onRedeployRetest && (
        <button
          type="button"
          onClick={onRedeployRetest}
          className="rounded-lg bg-dispatch-teal/20 px-3 py-2 text-sm font-medium text-dispatch-teal hover:bg-dispatch-teal/30"
        >
          Redeploy + Retest
        </button>
      )}
    </div>
  );
}

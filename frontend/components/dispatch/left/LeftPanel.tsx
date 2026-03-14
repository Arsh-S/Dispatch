"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { RunHeader } from "./RunHeader";
import { OrchestratorSpecCard } from "./OrchestratorSpecCard";
import { SetupAccordion } from "./SetupAccordion";
import { OrchestratorPlanFeed } from "./OrchestratorPlanFeed";
import { RunMetricsGrid } from "./RunMetricsGrid";

export function LeftPanel() {
  const {
    runName,
    environment,
    runStatus,
    orchestratorSpec,
    planPreviewItems,
    metrics,
    setRunStatus,
  } = useDispatchWorkspace();

  const handlePrimaryAction = () => {
    if (runStatus === "idle") setRunStatus("planning");
    else if (runStatus === "completed") setRunStatus("idle");
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <RunHeader
        runName={runName}
        environment={environment}
        status={runStatus}
        onPrimaryAction={handlePrimaryAction}
      />
      <OrchestratorSpecCard spec={orchestratorSpec} />
      <SetupAccordion />
      <OrchestratorPlanFeed items={planPreviewItems} />
      <RunMetricsGrid metrics={metrics} />
    </div>
  );
}

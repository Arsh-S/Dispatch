"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { RunHeader } from "./RunHeader";
import { OrchestratorSpecCard } from "./OrchestratorSpecCard";
import { SetupAccordion } from "./SetupAccordion";
import { PreReconCard } from "./PreReconCard";
import { OrchestratorPlanFeed } from "./OrchestratorPlanFeed";
import { RunMetricsGrid } from "./RunMetricsGrid";
import { FindingsListCard } from "./FindingsListCard";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LeftPanel() {
  const {
    runName,
    environment,
    runStatus,
    orchestratorSpec,
    preRecon,
    planPreviewItems,
    findings,
    metrics,
    setRunStatus,
    selectNode,
    isLoading,
    lastUpdated,
  } = useDispatchWorkspace();

  const handlePrimaryAction = () => {
    if (runStatus === "idle") setRunStatus("planning");
    else if (runStatus === "completed") setRunStatus("idle");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 shrink-0">
        <RunHeader
          runName={runName}
          environment={environment}
          status={runStatus}
          onPrimaryAction={handlePrimaryAction}
          isLoading={isLoading}
          lastUpdated={lastUpdated}
        />
      </div>
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <OrchestratorSpecCard spec={orchestratorSpec} />
          <SetupAccordion />
          <PreReconCard preRecon={preRecon} />
          <OrchestratorPlanFeed items={planPreviewItems} />
          <FindingsListCard
            findings={findings}
            onSelectFinding={(id) => selectNode(id)}
          />
          <RunMetricsGrid metrics={metrics} />
        </div>
      </ScrollArea>
    </div>
  );
}

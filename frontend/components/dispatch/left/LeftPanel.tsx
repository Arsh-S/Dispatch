"use client";

import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { RunHeader } from "./RunHeader";
import { PreReconCard } from "./PreReconCard";
import { FindingsListCard } from "./FindingsListCard";
import { RunMetricsGrid } from "./RunMetricsGrid";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LeftPanel() {
  const {
    runName,
    environment,
    runStatus,
    preRecon,
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
          runName={runName || "Dispatch Run"}
          environment={environment}
          status={runStatus}
          onPrimaryAction={handlePrimaryAction}
          isLoading={isLoading}
          lastUpdated={lastUpdated}
        />
      </div>
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4 pt-0">
          {preRecon && (
            <section id="recon" className="scroll-mt-4">
              <PreReconCard preRecon={preRecon} />
            </section>
          )}

          {findings.length > 0 && (
            <section id="findings" className="scroll-mt-4">
              <FindingsListCard
                findings={findings}
                onSelectFinding={(id) => selectNode(id)}
              />
            </section>
          )}

          <section id="metrics" className="scroll-mt-4">
            <RunMetricsGrid metrics={metrics} />
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useDispatchWorkspace } from "@/lib/dispatch/state";
import { RunHeader } from "./RunHeader";
import { OrchestratorSpecCard } from "./OrchestratorSpecCard";
import { SetupAccordion } from "./SetupAccordion";
import { PreReconCard } from "./PreReconCard";
import { OrchestratorPlanFeed } from "./OrchestratorPlanFeed";
import { RunMetricsGrid } from "./RunMetricsGrid";
import { FindingsListCard } from "./FindingsListCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  SlidersHorizontal,
  SearchCheck,
  ListTodo,
  ShieldAlert,
  ChartColumn,
} from "lucide-react";

const sidebarSections = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "setup", label: "Setup", Icon: SlidersHorizontal },
  { id: "recon", label: "Recon", Icon: SearchCheck },
  { id: "plan", label: "Plan", Icon: ListTodo },
  { id: "findings", label: "Findings", Icon: ShieldAlert },
  { id: "metrics", label: "Metrics", Icon: ChartColumn },
] as const;

export function LeftPanel() {
  const [activeSection, setActiveSection] = useState<string>("overview");
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

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
          <section className="rounded-xl bg-card/95 p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Sections
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sidebarSections.map(({ id, label, Icon }) => {
                const isActive = activeSection === id;
                return (
                  <Button
                    key={id}
                    variant={isActive ? "secondary" : "outline"}
                    size="xs"
                    onClick={() => handleSectionClick(id)}
                    className="h-7 rounded-full px-2.5 text-[11px]"
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </Button>
                );
              })}
            </div>
          </section>

          <section id="overview" className="scroll-mt-4">
            <OrchestratorSpecCard spec={orchestratorSpec} />
          </section>

          <section id="setup" className="scroll-mt-4">
            <SetupAccordion />
          </section>

          <section id="recon" className="scroll-mt-4">
            <PreReconCard preRecon={preRecon} />
          </section>

          <section id="plan" className="scroll-mt-4">
            <OrchestratorPlanFeed items={planPreviewItems} />
          </section>

          <section id="findings" className="scroll-mt-4">
            <FindingsListCard
              findings={findings}
              onSelectFinding={(id) => selectNode(id)}
            />
          </section>

          <section id="metrics" className="scroll-mt-4">
            <RunMetricsGrid metrics={metrics} />
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

"use client";

import { DispatchWorkspaceProvider, useDispatchWorkspace } from "@/lib/dispatch/state";
import { GraphWorkspace } from "./graph/GraphWorkspace";
import { NodeInspectorSidebar } from "./inspector/NodeInspectorSidebar";
import { Terminal } from "lucide-react";

function EmptyScanState() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 px-8 text-center max-w-md">
        <div className="flex size-14 items-center justify-center rounded-xl bg-muted/50 border border-border">
          <Terminal className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">No scan data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Run a scan to visualize agent activity and findings.
          </p>
        </div>
        <pre className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs font-mono text-foreground/80">
          pnpm tsx src/cli.ts scan &lt;path&gt;
        </pre>
      </div>
    </div>
  );
}

function DispatchWorkspaceInner() {
  const { graphData, dispatchRunId } = useDispatchWorkspace();

  const hasData =
    dispatchRunId !== null && Object.keys(graphData.nodes).length > 0;

  if (!hasData) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <EmptyScanState />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <main className="relative flex flex-1 min-w-0">
        <GraphWorkspace />
      </main>
      <NodeInspectorSidebar />
    </div>
  );
}

export function DispatchWorkspace() {
  return (
    <DispatchWorkspaceProvider>
      <DispatchWorkspaceInner />
    </DispatchWorkspaceProvider>
  );
}

"use client";

import { DispatchWorkspaceProvider } from "@/lib/dispatch/state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LeftPanel } from "./left/LeftPanel";
import { GraphWorkspace } from "./graph/GraphWorkspace";
import { NodeInspectorSidebar } from "./inspector/NodeInspectorSidebar";

export function DispatchWorkspace() {
  return (
    <DispatchWorkspaceProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <aside className="flex w-[360px] shrink-0 flex-col bg-card/50">
          <ScrollArea className="flex-1 overflow-y-auto">
            <LeftPanel />
          </ScrollArea>
        </aside>
        <main className="flex flex-1 flex-col min-w-0">
          <GraphWorkspace />
        </main>
        <NodeInspectorSidebar />
      </div>
    </DispatchWorkspaceProvider>
  );
}

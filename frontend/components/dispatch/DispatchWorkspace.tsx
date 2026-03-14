"use client";

import { DispatchWorkspaceProvider } from "@/lib/dispatch/state";
import { LeftPanel } from "./left/LeftPanel";
import { GraphWorkspace } from "./graph/GraphWorkspace";
import { NodeInspectorSidebar } from "./inspector/NodeInspectorSidebar";

export function DispatchWorkspace() {
  return (
    <DispatchWorkspaceProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-dispatch-charcoal text-slate-200">
        <aside className="flex w-[22%] min-w-[220px] max-w-[280px] flex-col border-r border-dispatch-muted bg-dispatch-slate/20 overflow-y-auto">
          <LeftPanel />
        </aside>
        <main className="flex flex-1 flex-col min-w-0">
          <GraphWorkspace />
        </main>
        <NodeInspectorSidebar />
      </div>
    </DispatchWorkspaceProvider>
  );
}

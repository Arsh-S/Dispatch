# Sidebar UI Merge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge UI components from `arsh-frontend-ui` branch to add a left sidebar showing real backend data (PreRecon, Findings, Metrics).

**Architecture:** Cherry-pick and adapt UI components from `arsh-frontend-ui`, removing hardcoded mock data. The sidebar will display data from `DispatchOutput` fetched via polling. State management stays minimal with derived `runName` from `repo.name`.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui components

**Spec:** `docs/superpowers/specs/2026-03-14-sidebar-ui-merge-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `components/dispatch/common/StatusBadge.tsx` | Create | Reusable status badge with color variants |
| `components/dispatch/left/LeftPanel.tsx` | Create | Main sidebar container with 4 sections |
| `components/dispatch/left/RunHeader.tsx` | Create | Run name, status, sync indicator |
| `components/dispatch/left/PreReconCard.tsx` | Create | Display routes, risk signals, dependencies |
| `components/dispatch/left/FindingsListCard.tsx` | Create | List findings with severity/status |
| `components/dispatch/left/RunMetricsGrid.tsx` | Create | 6-metric grid display |
| `components/dispatch/DispatchWorkspace.tsx` | Modify | Add LeftPanel to layout |
| `lib/dispatch/state.tsx` | Modify | Add runName, setRunStatus |
| `app/globals.css` | Modify | Add scrollbar styling |

---

## Chunk 1: Foundation Components

### Task 1: Create StatusBadge Component

**Files:**
- Create: `components/dispatch/common/StatusBadge.tsx`

- [ ] **Step 1: Create the common directory**

```bash
mkdir -p components/dispatch/common
```

- [ ] **Step 2: Extract StatusBadge from arsh-frontend-ui branch**

```bash
git show arsh-frontend-ui:frontend/components/dispatch/common/StatusBadge.tsx > components/dispatch/common/StatusBadge.tsx
```

- [ ] **Step 3: Verify the component has no hardcoded data**

Open `components/dispatch/common/StatusBadge.tsx` and confirm it only contains:
- Type definitions for `StatusVariant`
- `variantClasses` mapping (styling only)
- Pure presentation component

- [ ] **Step 4: Commit**

```bash
git add components/dispatch/common/StatusBadge.tsx
git commit -m "feat(ui): add StatusBadge component for status indicators"
```

---

### Task 2: Create RunMetricsGrid Component

**Files:**
- Create: `components/dispatch/left/RunMetricsGrid.tsx`

- [ ] **Step 1: Create the left directory**

```bash
mkdir -p components/dispatch/left
```

- [ ] **Step 2: Extract RunMetricsGrid from arsh-frontend-ui branch**

```bash
git show arsh-frontend-ui:frontend/components/dispatch/left/RunMetricsGrid.tsx > components/dispatch/left/RunMetricsGrid.tsx
```

- [ ] **Step 3: Verify the component uses only RunMetrics type**

Open `components/dispatch/left/RunMetricsGrid.tsx` and confirm:
- Imports `RunMetrics` from `@/lib/dispatch/graphTypes`
- Uses only these fields: `routesDiscovered`, `workersActive`, `findingsFound`, `ticketsCreated`, `prsOpened`, `retestsPassed`
- No hardcoded data

- [ ] **Step 4: Commit**

```bash
git add components/dispatch/left/RunMetricsGrid.tsx
git commit -m "feat(ui): add RunMetricsGrid component for metrics display"
```

---

### Task 3: Create FindingsListCard Component

**Files:**
- Create: `components/dispatch/left/FindingsListCard.tsx`

- [ ] **Step 1: Extract FindingsListCard from arsh-frontend-ui branch**

```bash
git show arsh-frontend-ui:frontend/components/dispatch/left/FindingsListCard.tsx > components/dispatch/left/FindingsListCard.tsx
```

- [ ] **Step 2: Verify the component uses only Finding type**

Open `components/dispatch/left/FindingsListCard.tsx` and confirm:
- Imports `Finding` from `@/lib/dispatch/graphTypes`
- Uses fields: `finding_id`, `severity`, `vuln_type`, `location.endpoint`, `exploit_confidence`, `fix_status`
- Handles empty findings array gracefully (returns null)

- [ ] **Step 3: Commit**

```bash
git add components/dispatch/left/FindingsListCard.tsx
git commit -m "feat(ui): add FindingsListCard component for findings display"
```

---

### Task 4: Create PreReconCard Component

**Files:**
- Create: `components/dispatch/left/PreReconCard.tsx`

- [ ] **Step 1: Extract PreReconCard from arsh-frontend-ui branch**

```bash
git show arsh-frontend-ui:frontend/components/dispatch/left/PreReconCard.tsx > components/dispatch/left/PreReconCard.tsx
```

- [ ] **Step 2: Verify the component uses only PreReconDeliverable type**

Open `components/dispatch/left/PreReconCard.tsx` and confirm:
- Imports `PreReconDeliverable` from `@/lib/dispatch/graphTypes`
- Uses fields: `route_map`, `risk_signals`, `dependency_graph`, `briefing_notes`
- Handles null preRecon gracefully (returns null)

- [ ] **Step 3: Commit**

```bash
git add components/dispatch/left/PreReconCard.tsx
git commit -m "feat(ui): add PreReconCard component for pre-recon display"
```

---

## Chunk 2: Header and State Updates

### Task 5: Create RunHeader Component

**Files:**
- Create: `components/dispatch/left/RunHeader.tsx`

- [ ] **Step 1: Extract RunHeader from arsh-frontend-ui branch**

```bash
git show arsh-frontend-ui:frontend/components/dispatch/left/RunHeader.tsx > components/dispatch/left/RunHeader.tsx
```

- [ ] **Step 2: Verify the component props match backend data**

Open `components/dispatch/left/RunHeader.tsx` and confirm props:
- `runName: string` - will come from `repo.name`
- `environment: string` - will be "staging" default
- `status: string` - from `DispatchOutput.status`
- `isLoading?: boolean` - from state
- `lastUpdated?: string | null` - from state

- [ ] **Step 3: Commit**

```bash
git add components/dispatch/left/RunHeader.tsx
git commit -m "feat(ui): add RunHeader component for run status display"
```

---

### Task 6: Update state.tsx with new fields

**Files:**
- Modify: `lib/dispatch/state.tsx:44-84,91-92,135-145,169-216`

- [ ] **Step 1: Update DispatchWorkspaceState interface (line 44-62)**

Add `runName` and `environment` to the interface. Replace lines 44-62:

```typescript
export interface DispatchWorkspaceState {
  dispatchRunId: string | null;
  runStatus: RunStatus;
  runName: string;
  environment: string;

  preRecon: PreReconDeliverable | null;
  taskAssignments: TaskAssignment[];
  findingReports: FindingReport[];
  findings: Finding[];

  metrics: RunMetrics;
  graphData: GraphData;

  selectedNodeId: NodeId | null;
  sidebarOpen: boolean;

  isLoading: boolean;
  lastUpdated: string | null;
  error: string | null;
}
```

- [ ] **Step 2: Update DispatchWorkspaceContextValue type (line 75-84)**

Add `setRunStatus` to the context value type. Replace lines 75-84:

```typescript
type DispatchWorkspaceContextValue = DispatchWorkspaceState & {
  selectNode: (id: NodeId | null) => void;
  selectFinding: (id: string | null) => void;
  getFindingById: (id: string) => Finding | undefined;
  getAssignmentByWorkerId: (workerId: string) => TaskAssignment | undefined;
  getReportByWorkerId: (workerId: string) => FindingReport | undefined;
  setSidebarOpen: (open: boolean) => void;
  setRunStatus: (status: RunStatus) => void;
  loadDispatchOutput: (data: DispatchOutput) => void;
  refreshData: () => Promise<void>;
};
```

- [ ] **Step 3: Add runName and environment state (after line 91)**

Add these two lines after `const [runStatus, setRunStatus] = useState<RunStatus>("idle");`:

```typescript
const [runName, setRunName] = useState<string>("");
const [environment] = useState<string>("staging");
```

- [ ] **Step 4: Add setRunStatus callback (after line 133)**

Add after the `setSidebarOpen` callback:

```typescript
const setRunStatusFn = useCallback((status: RunStatus) => setRunStatus(status), []);
```

- [ ] **Step 5: Update loadDispatchOutput to set runName (line 135-145)**

Add `setRunName` call inside the callback. The updated callback should be:

```typescript
const loadDispatchOutput = useCallback((data: DispatchOutput) => {
  setDispatchRunId(data.dispatch_run_id);
  setRunStatus(data.status);
  setRunName(data.repo?.name ?? "Dispatch Run");
  if (data.pre_recon) setPreRecon(data.pre_recon);
  setTaskAssignments(data.task_assignments);
  setFindingReports(data.finding_reports);
  setFindings(data.findings);
  setMetrics(data.metrics);
  if (data.graph_data) setGraphData(data.graph_data);
  setLastUpdated(new Date().toISOString());
}, []);
```

- [ ] **Step 6: Update useMemo value object (line 169-192)**

Add the new fields to the value object:

```typescript
const value = useMemo<DispatchWorkspaceContextValue>(
  () => ({
    dispatchRunId,
    runStatus,
    runName,
    environment,
    preRecon,
    taskAssignments,
    findingReports,
    findings,
    metrics,
    graphData,
    selectedNodeId,
    sidebarOpen,
    isLoading,
    lastUpdated,
    error,
    selectNode,
    selectFinding,
    getFindingById,
    getAssignmentByWorkerId,
    getReportByWorkerId,
    setSidebarOpen,
    setRunStatus: setRunStatusFn,
    loadDispatchOutput,
    refreshData,
  }),
  [
    dispatchRunId,
    runStatus,
    runName,
    environment,
    preRecon,
    taskAssignments,
    findingReports,
    findings,
    metrics,
    graphData,
    selectedNodeId,
    sidebarOpen,
    isLoading,
    lastUpdated,
    error,
    selectNode,
    selectFinding,
    getFindingById,
    getAssignmentByWorkerId,
    getReportByWorkerId,
    setSidebarOpen,
    setRunStatusFn,
    loadDispatchOutput,
    refreshData,
  ]
);
```

- [ ] **Step 7: Commit**

```bash
git add lib/dispatch/state.tsx
git commit -m "feat(state): add runName, environment, setRunStatus for sidebar"
```

---

## Chunk 3: LeftPanel and Layout Integration

### Task 7: Create LeftPanel Component

**Files:**
- Create: `components/dispatch/left/LeftPanel.tsx`

- [ ] **Step 1: Create simplified LeftPanel (without excluded sections)**

Create `components/dispatch/left/LeftPanel.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify no hardcoded data in LeftPanel**

Confirm:
- All data comes from `useDispatchWorkspace()` hook
- No mock functions or hardcoded values
- Conditional rendering handles null/empty states

- [ ] **Step 3: Commit**

```bash
git add components/dispatch/left/LeftPanel.tsx
git commit -m "feat(ui): add LeftPanel container with real data sections only"
```

---

### Task 8: Update DispatchWorkspace Layout

**Files:**
- Modify: `components/dispatch/DispatchWorkspace.tsx:4,43-50`

- [ ] **Step 1: Add LeftPanel import (after line 4)**

Add after the GraphWorkspace import (line 4):

```typescript
import { LeftPanel } from "./left/LeftPanel";
```

- [ ] **Step 2: Replace the hasData return block (lines 43-50)**

Replace lines 43-50 (the return statement when `hasData` is true) with:

```tsx
return (
  <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
    <aside className="flex w-[360px] shrink-0 flex-col bg-card/50 border-r border-border">
      <LeftPanel />
    </aside>
    <main className="relative flex flex-1 min-w-0">
      <GraphWorkspace />
    </main>
    <NodeInspectorSidebar />
  </div>
);
```

- [ ] **Step 3: Commit**

```bash
git add components/dispatch/DispatchWorkspace.tsx
git commit -m "feat(layout): integrate LeftPanel sidebar into workspace"
```

---

## Chunk 4: Styling Updates

### Task 9: Update globals.css with scrollbar styling

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add scrollbar styling at end of file**

Append to `app/globals.css` (after line 96):

```css

/* Custom scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
```

Note: `.scroll-mt-4` is a built-in Tailwind utility and does not need to be added.

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: add custom scrollbar styling"
```

---

### Task 10: Verify and Test

**Files:**
- All created/modified files

- [ ] **Step 1: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: No type errors

- [ ] **Step 2: Run dev server**

```bash
pnpm dev
```

Expected: Server starts without errors

- [ ] **Step 3: Visual verification**

Open http://localhost:3000 and verify:
- Left sidebar (360px) appears with RunHeader
- PreRecon section shows route_map, risk_signals if data exists
- Findings section shows if findings exist (may be empty)
- Metrics grid shows 6 metrics
- No hardcoded "Demo" or mock data visible

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from integration testing"
```

---

## Summary

| Task | Component | Status |
|------|-----------|--------|
| 1 | StatusBadge | Pending |
| 2 | RunMetricsGrid | Pending |
| 3 | FindingsListCard | Pending |
| 4 | PreReconCard | Pending |
| 5 | RunHeader | Pending |
| 6 | state.tsx updates | Pending |
| 7 | LeftPanel | Pending |
| 8 | DispatchWorkspace layout | Pending |
| 9 | globals.css styling | Pending |
| 10 | Verify and test | Pending |

**Total tasks:** 10
**Estimated steps:** ~35

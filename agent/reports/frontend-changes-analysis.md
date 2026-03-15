# Frontend Changes Analysis: Sidebar UI Merge

**Generated:** 2026-03-14
**Base commit (main):** d3e0ea8
**Source:** worktree at `/tmp/dispatch-pull-wt` (pulled from remote)
**Commits (10 total, frontend-specific):**

```
b3798b7 updated graph ui
6566b9b style: add custom scrollbar styling
03d66ca feat(layout): integrate LeftPanel sidebar into workspace
06607eb feat(ui): add LeftPanel container with real data sections only
003cbb2 feat(state): add runName, environment, setRunStatus for sidebar
6105052 feat(ui): add RunHeader component for run status display
23df6af feat(ui): add PreReconCard component for pre-recon display
604e00c feat(ui): add FindingsListCard component for findings display
92b1867 feat(ui): add RunMetricsGrid component for metrics display
559d43b docs: add sidebar UI merge implementation plan
38dfef4 docs: add sidebar UI merge design spec
```

---

## Table of Contents

1. [Overview](#overview)
2. [New Files](#new-files)
3. [Modified Files](#modified-files)
4. [Order of Operations](#order-of-operations)
5. [Potential Conflicts](#potential-conflicts)

---

## Overview

This changeset adds a **left sidebar panel** (360px wide) to the Dispatch workspace. The sidebar displays real-time data from `DispatchOutput` including run header/status, pre-recon results, findings list, and metrics grid. It also includes graph rendering improvements (orchestrator node styling, layout persistence, label formatting).

**Architecture change:** The workspace layout goes from a 2-panel layout (`GraphWorkspace | NodeInspectorSidebar`) to a 3-panel layout (`LeftPanel | GraphWorkspace | NodeInspectorSidebar`).

**No new npm dependencies are required.** All imports use existing packages (`lucide-react`, shadcn/ui components, `d3-force`). The existing `StatusBadge` component at `components/dispatch/common/StatusBadge.tsx` is already present on main and does not need to be created.

---

## New Files

### 1. `frontend/components/dispatch/left/RunMetricsGrid.tsx` (NEW)

**Purpose:** Renders a 3-column grid of 6 metrics (Routes, Workers, Findings, Tickets, PRs, Retests).

**Dependencies:**
- `@/lib/dispatch/graphTypes` (type `RunMetrics`)
- `lucide-react` icons: `Route`, `Users`, `Bug`, `Ticket`, `GitPullRequest`, `CheckCheck`

**Full content:**

```tsx
"use client";

import type { RunMetrics } from "@/lib/dispatch/graphTypes";
import {
  Route,
  Users,
  Bug,
  Ticket,
  GitPullRequest,
  CheckCheck,
} from "lucide-react";

export interface RunMetricsGridProps {
  metrics: RunMetrics;
}

const metricConfig: { key: keyof RunMetrics; label: string; Icon: React.ElementType }[] = [
  { key: "routesDiscovered", label: "Routes", Icon: Route },
  { key: "workersActive", label: "Workers", Icon: Users },
  { key: "findingsFound", label: "Findings", Icon: Bug },
  { key: "ticketsCreated", label: "Tickets", Icon: Ticket },
  { key: "prsOpened", label: "PRs", Icon: GitPullRequest },
  { key: "retestsPassed", label: "Retests", Icon: CheckCheck },
];

export function RunMetricsGrid({ metrics }: RunMetricsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {metricConfig.map(({ key, label, Icon }) => (
        <div
          key={key}
          className="flex flex-col items-center gap-1 rounded-lg bg-card p-3"
        >
          <Icon className="size-4 text-muted-foreground" />
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {metrics[key]}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
```

---

### 2. `frontend/components/dispatch/left/FindingsListCard.tsx` (NEW)

**Purpose:** Displays a scrollable list of findings sorted by severity, with severity badges, vuln type, endpoint, exploit confidence, and fix status icons. Clicking a finding calls `onSelectFinding`.

**Dependencies:**
- `@/components/ui/card` (`Card`, `CardContent`, `CardHeader`, `CardTitle`)
- `@/components/ui/badge` (`Badge`)
- `@/components/ui/scroll-area` (`ScrollArea`)
- `lucide-react` icons: `AlertTriangle`, `CheckCircle`, `XCircle`, `Clock`, `Wrench`
- `@/lib/dispatch/graphTypes` (type `Finding`)

**Full content:**

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Wrench,
} from "lucide-react";
import type { Finding } from "@/lib/dispatch/graphTypes";

export interface FindingsListCardProps {
  findings: Finding[];
  onSelectFinding: (findingId: string) => void;
}

function getSeverityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "bg-destructive/20 text-destructive ";
    case "MEDIUM":
      return "bg-muted text-muted-foreground ";
    case "LOW":
    default:
      return "bg-muted/50 text-muted-foreground ";
  }
}

function getFixStatusIcon(status?: string) {
  switch (status) {
    case "verified":
      return <CheckCircle className="w-3 h-3 text-primary" />;
    case "in-progress":
      return <Wrench className="w-3 h-3 text-primary" />;
    case "failed":
      return <XCircle className="w-3 h-3 text-destructive" />;
    default:
      return <Clock className="w-3 h-3 text-muted-foreground" />;
  }
}

export function FindingsListCard({ findings, onSelectFinding }: FindingsListCardProps) {
  if (findings.length === 0) return null;

  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedFindings = [...findings].sort(
    (a, b) =>
      (severityOrder[a.severity as keyof typeof severityOrder] || 4) -
      (severityOrder[b.severity as keyof typeof severityOrder] || 4)
  );

  return (
    <Card size="sm" className="bg-destructive/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-destructive uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Findings ({findings.length})
          </CardTitle>
          <div className="flex gap-1 text-[9px]">
            <Badge className="bg-destructive/20 text-destructive  px-1 py-0">
              {findings.filter((f) => f.severity === "CRITICAL").length} CRIT
            </Badge>
            <Badge className="bg-destructive/20 text-destructive  px-1 py-0">
              {findings.filter((f) => f.severity === "HIGH").length} HIGH
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-48">
          <ul>
            {sortedFindings.map((finding) => (
              <li
                key={finding.finding_id}
                onClick={() => onSelectFinding(finding.finding_id)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <Badge className={`${getSeverityColor(finding.severity)} text-[9px] px-1.5 py-0 shrink-0`}>
                  {finding.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {finding.vuln_type.replace(/-/g, " ")}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {finding.location.endpoint}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <span title={finding.exploit_confidence === "confirmed" ? "Confirmed" : "Unconfirmed"}>
                    {finding.exploit_confidence === "confirmed" ? (
                      <CheckCircle className="w-3 h-3 text-primary" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                    )}
                  </span>
                  {getFixStatusIcon(finding.fix_status)}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

**Note:** The `Card` component is used with `size="sm"` prop. Verify this prop is supported by the shadcn/ui Card on main. If not, remove it or add size variant support.

---

### 3. `frontend/components/dispatch/left/PreReconCard.tsx` (NEW)

**Purpose:** Displays pre-recon results: summary stats (route count, risk signal count), expandable/collapsible detail sections for risk signals, routes, dependency graph, and briefing notes.

**Dependencies:**
- `react` (`useState`)
- `@/components/ui/card` (`Card`, `CardContent`, `CardHeader`, `CardTitle`)
- `@/components/ui/badge` (`Badge`)
- `@/components/ui/button` (`Button`)
- `lucide-react` icons: `Route`, `AlertTriangle`, `ChevronDown`, `ChevronUp`, `Database`, `Shield`, `FileCode`
- `@/lib/dispatch/graphTypes` (type `PreReconDeliverable`)

**Full content:**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Route,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Database,
  Shield,
  FileCode,
} from "lucide-react";
import type { PreReconDeliverable } from "@/lib/dispatch/graphTypes";

export interface PreReconCardProps {
  preRecon: PreReconDeliverable | null;
}

export function PreReconCard({ preRecon }: PreReconCardProps) {
  const [expanded, setExpanded] = useState(true);

  if (!preRecon) return null;

  return (
    <Card size="sm" className="">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Pre-Recon Results
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
            <Route className="w-4 h-4 text-primary" />
            <div>
              <div className="text-sm font-medium">{preRecon.route_map.length}</div>
              <div className="text-xs text-muted-foreground">Routes</div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <div>
              <div className="text-sm font-medium">{preRecon.risk_signals.length}</div>
              <div className="text-xs text-muted-foreground">Risk Signals</div>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-1.5 pt-1">
            {/* Risk Signals */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Risk Signals
              </div>
              <ul className="space-y-1">
                {preRecon.risk_signals.map((signal, i) => (
                  <li key={i} className="text-base bg-destructive/10 rounded-md px-2 py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-destructive text-sm sm:text-[15px]">
                        {signal.pattern}
                      </span>
                      <div className="flex gap-1.5">
                        {signal.suggested_attack_types.map((type) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="text-[11px] px-1.5 py-0.5 leading-none"
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {signal.file}:{signal.line}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Route Map Preview */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Route className="w-4 h-4" />
                Routes
              </div>
              <ul className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {preRecon.route_map.map((route, i) => (
                  <li
                    key={i}
                    className="text-base flex items-center justify-between bg-muted/50 rounded-md px-2 py-1"
                  >
                    <span className="font-mono text-primary text-sm sm:text-[15px]">
                      {route.endpoint}
                    </span>
                    <div className="flex gap-1.5">
                      {route.middleware.length === 0 ? (
                        <Badge className="text-[11px] px-1.5 py-0.5 leading-none bg-destructive/20 text-destructive ">
                          no auth
                        </Badge>
                      ) : (
                        route.middleware.map((mw) => (
                          <Badge
                            key={mw}
                            variant="outline"
                            className="text-[11px] px-1.5 py-0.5 leading-none"
                          >
                            {mw}
                          </Badge>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dependency Graph */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                Dependencies
              </div>
              <div className="text-base bg-muted/50 rounded-md px-2 py-1.5 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DB Layer:</span>
                  <span className="font-mono text-foreground text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.db_layer}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ORM:</span>
                  <span className="font-mono text-foreground text-right max-w-[220px] truncate text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.orm}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auth:</span>
                  <span className="font-mono text-foreground text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.auth_middleware}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="font-mono text-foreground text-right max-w-[220px] truncate text-sm sm:text-[15px]">
                    {preRecon.dependency_graph.session_store}
                  </span>
                </div>
              </div>
            </div>

            {/* Briefing Notes */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-4 h-4" />
                Briefing
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {preRecon.briefing_notes}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Note:** Same `Card size="sm"` caveat as FindingsListCard.

---

### 4. `frontend/components/dispatch/left/RunHeader.tsx` (NEW)

**Purpose:** Displays the run title ("Dispatch"), run name, environment/status badges, sync indicator (loading spinner or refresh icon with timestamp), and a primary action button (Launch/Pause/Redeploy).

**Dependencies:**
- `@/components/dispatch/common/StatusBadge` (`StatusBadge`, type `StatusVariant`) -- already exists on main
- `@/components/ui/button` (`Button`)
- `@/components/ui/separator` (`Separator`) -- imported but not used in JSX
- `lucide-react` icons: `Play`, `Pause`, `RotateCcw`, `Loader2`, `RefreshCw`

**Full content:**

```tsx
"use client";

import { StatusBadge, type StatusVariant } from "@/components/dispatch/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  RotateCcw,
  Loader2,
  RefreshCw,
} from "lucide-react";

export interface RunHeaderProps {
  runName: string;
  environment: string;
  status: string;
  onPrimaryAction: () => void;
  isLoading?: boolean;
  lastUpdated?: string | null;
}

const statusToVariant: Record<string, StatusVariant> = {
  idle: "idle",
  planning: "planning",
  executing: "executing",
  patching: "fixer",
  retesting: "retest",
  completed: "completed",
};

function primaryButtonConfig(status: string): { label: string; Icon: React.ElementType } {
  switch (status) {
    case "idle":
      return { label: "Launch Dispatch", Icon: Play };
    case "planning":
    case "executing":
    case "patching":
    case "retesting":
      return { label: "Pause Run", Icon: Pause };
    case "completed":
      return { label: "Redeploy + Retest", Icon: RotateCcw };
    default:
      return { label: "Launch Dispatch", Icon: Play };
  }
}

function formatLastUpdated(timestamp: string | null | undefined): string {
  if (!timestamp) return "\u2014";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function RunHeader({
  runName,
  environment,
  status,
  onPrimaryAction,
  isLoading,
  lastUpdated,
}: RunHeaderProps) {
  const variant = statusToVariant[status] ?? "idle";
  const { label, Icon } = primaryButtonConfig(status);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Dispatch</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{runName}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{formatLastUpdated(lastUpdated)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant="idle">{environment}</StatusBadge>
        <StatusBadge variant={variant}>{status}</StatusBadge>
        {isLoading && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            syncing
          </span>
        )}
      </div>
      <Button
        onClick={onPrimaryAction}
        className="w-full gap-2"
        size="sm"
      >
        <Icon className="size-4" />
        {label}
      </Button>
    </div>
  );
}
```

**Note:** The `Separator` import is unused but present in the source. It can be removed during merge if desired.

---

### 5. `frontend/components/dispatch/left/LeftPanel.tsx` (NEW)

**Purpose:** Main sidebar container. Pulls all state from `useDispatchWorkspace()` and renders RunHeader (fixed top), then a scrollable area containing PreReconCard, FindingsListCard, and RunMetricsGrid.

**Dependencies:**
- `@/lib/dispatch/state` (`useDispatchWorkspace`)
- `@/components/ui/scroll-area` (`ScrollArea`)
- All four sibling components in `left/`

**Full content:**

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

---

### 6. `frontend/docs/superpowers/plans/2026-03-14-sidebar-ui-merge.md` (NEW)

Implementation plan document. Not needed for the merge itself but is part of the changeset for documentation purposes.

### 7. `frontend/docs/superpowers/specs/2026-03-14-sidebar-ui-merge-design.md` (NEW)

Design spec document. Same as above -- documentation only.

---

## Modified Files

### 1. `frontend/lib/dispatch/state.tsx`

**Summary:** Adds `runName`, `environment`, and `setRunStatus` to state management, enabling the LeftPanel to display and control run state.

**Diff details (4 changes):**

#### Change A: Add `runName` and `environment` to `DispatchWorkspaceState` interface

**Current (main) lines 44-62:**
```typescript
export interface DispatchWorkspaceState {
  dispatchRunId: string | null;
  runStatus: RunStatus;

  preRecon: PreReconDeliverable | null;
  // ...
```

**New (add two fields after `runStatus`):**
```typescript
export interface DispatchWorkspaceState {
  dispatchRunId: string | null;
  runStatus: RunStatus;
  runName: string;
  environment: string;

  preRecon: PreReconDeliverable | null;
  // ...
```

#### Change B: Add `setRunStatus` to context value type

**Current (main) line 82:**
```typescript
  setSidebarOpen: (open: boolean) => void;
  loadDispatchOutput: (data: DispatchOutput) => void;
```

**New (insert `setRunStatus` between them):**
```typescript
  setSidebarOpen: (open: boolean) => void;
  setRunStatus: (status: RunStatus) => void;
  loadDispatchOutput: (data: DispatchOutput) => void;
```

#### Change C: Add state variables and callback in provider

**Current (main) lines 90-91:**
```typescript
  const [dispatchRunId, setDispatchRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
```

**New (add two lines after):**
```typescript
  const [dispatchRunId, setDispatchRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runName, setRunName] = useState<string>("");
  const [environment] = useState<string>("staging");
```

**Also add after the `setSidebarOpen` callback (after current line 133):**
```typescript
  const setRunStatusFn = useCallback((status: RunStatus) => setRunStatus(status), []);
```

#### Change D: Update `loadDispatchOutput` to set `runName`

**Current (main) line 135-145:**
```typescript
  const loadDispatchOutput = useCallback((data: DispatchOutput) => {
    setDispatchRunId(data.dispatch_run_id);
    setRunStatus(data.status);
    if (data.pre_recon) setPreRecon(data.pre_recon);
```

**New (add `setRunName` line):**
```typescript
  const loadDispatchOutput = useCallback((data: DispatchOutput) => {
    setDispatchRunId(data.dispatch_run_id);
    setRunStatus(data.status);
    setRunName(data.repo?.name ?? "Dispatch Run");
    if (data.pre_recon) setPreRecon(data.pre_recon);
```

#### Change E: Update `useMemo` value and deps

**Add to the value object (after `runStatus,`):**
```typescript
    runName,
    environment,
```

**Replace `setSidebarOpen,` in value object with:**
```typescript
    setSidebarOpen,
    setRunStatus: setRunStatusFn,
```

**Add to dependency array (after `runStatus,`):**
```typescript
    runName,
    environment,
```

**Replace `setSidebarOpen,` in deps array with:**
```typescript
    setSidebarOpen,
    setRunStatusFn,
```

---

### 2. `frontend/components/dispatch/DispatchWorkspace.tsx`

**Summary:** Adds the LeftPanel sidebar to the workspace layout.

**Change A: Add import (after line 5):**

```typescript
import { LeftPanel } from "./left/LeftPanel";
```

**Change B: Replace the hasData return block.**

**Current (main) lines 44-49:**
```tsx
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <main className="relative flex flex-1 min-w-0">
        <GraphWorkspace />
      </main>
      <NodeInspectorSidebar />
    </div>
```

**New:**
```tsx
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-[360px] shrink-0 flex-col bg-card/50 border-r border-border">
        <LeftPanel />
      </aside>
      <main className="relative flex min-w-0 flex-1 border-r border-border">
        <GraphWorkspace />
      </main>
      <NodeInspectorSidebar />
    </div>
```

Key layout changes:
- New `<aside>` element wrapping `LeftPanel`, 360px wide, `shrink-0`, with `bg-card/50` and right border
- `<main>` gets `border-r border-border` added, `flex-1 min-w-0` reordered (cosmetic)

---

### 3. `frontend/components/dispatch/graph/GraphWorkspace.tsx`

**Summary:** Moves the "Drag to pan" hint text from inside the legend to its own top-left overlay. Switches legend dot colors from Tailwind classes to inline style hex values.

**Change A: Add instructions overlay above zoom controls (insert after line 32):**

```tsx
          <div className="pointer-events-auto absolute left-3 top-3">
            <div className="rounded-lg border border-border bg-card/90 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] text-muted-foreground">
                Drag to pan &middot; Scroll to zoom &middot; Click to inspect
              </p>
            </div>
          </div>
```

**Change B: Update MinimalLegend colors from Tailwind classes to hex values:**

**Current (main) lines 65-70:**
```typescript
  const items = [
    { color: "bg-status-running", label: "Running" },
    { color: "bg-primary", label: "Success" },
    { color: "bg-status-error", label: "Failed" },
    { color: "bg-status-warning", label: "Warning" },
    { color: "bg-status-idle", label: "Idle" },
  ];
```

**New:**
```typescript
  const items = [
    { color: "#d4a853", label: "Running" },
    { color: "var(--primary)", label: "Success" },
    { color: "#ef6461", label: "Failed" },
    { color: "#e5954a", label: "Warning" },
    { color: "#6b7280", label: "Idle" },
  ];
```

**Change C: Legend dot rendering switches from className to inline style:**

**Current:**
```tsx
<span className={`size-2 rounded-full ${color}`} />
```

**New:**
```tsx
<span className="size-2 rounded-full" style={{ backgroundColor: color }} />
```

**Change D: Remove the "Drag to pan" text from inside the legend:**

**Current (main) lines 83-85:**
```tsx
      <p className="mt-1.5 text-[9px] text-muted-foreground/60">
        Drag to pan &middot; Scroll to zoom &middot; Click to inspect
      </p>
```

**New:** This paragraph is removed entirely from the legend component (it was moved to the top-left overlay in Change A).

---

### 4. `frontend/lib/dispatch/useForceGraph.ts`

**Summary:** Major enhancements to the force graph simulation including layout persistence (sessionStorage), graph fingerprinting for change detection, orchestrator node special rendering (white square instead of colored circle, larger radius), overlap detection/nudging, and improved simulation parameters.

**This is the largest diff. Key changes:**

#### Change A: Add graph fingerprinting function (new, before Types section)

```typescript
function computeGraphFingerprint(graphData: GraphData): string {
  const nodeIds = Object.keys(graphData.nodes).sort().join(",");
  const edgeKeys = graphData.edges
    .map((e) => `${e.from}->${e.to}`)
    .sort()
    .join(",");
  return `${nodeIds}|${edgeKeys}`;
}
```

#### Change B: Add constants for simulation behavior

**Current (main) lines 46-47:**
```typescript
const SUPABASE_GREEN = "#3ecf8e";
const SUPABASE_GREEN_DIM = "#2a9d6a";
```

**New (add after these):**
```typescript
const IDLE_ALPHA_TARGET = 0.05;
const DRAG_ALPHA_TARGET = 0.3;
const COLD_START_ALPHA = 1;
const RESTORE_ALPHA = 0.18;
const OVERLAP_REHEAT_ALPHA = 0.38;
const LAYOUT_STORAGE_PREFIX = "dispatch-force-layout:";
```

#### Change C: Add layout persistence functions

New functions `loadStoredLayout`, `saveStoredLayout`, `hashString`, and `nudgeOverlappingNodes` are added between the color constants and the hook. These handle:
- Saving/loading node positions to/from `sessionStorage`
- FNV-1a hashing for deterministic overlap resolution
- Detecting and resolving overlapping nodes after layout restore

#### Change D: Add refs for fingerprinting

**Current (main) line 81:**
```typescript
  const rafRef = useRef<number>(0);
```

**New (add after):**
```typescript
  const prevFingerprintRef = useRef<string>("");
  const initialBuildDoneRef = useRef(false);
```

#### Change E: Rewrite `buildSim` with fingerprint checking, layout restoration, orchestrator special handling

Key differences in `buildSim`:
- **Skip rebuild if fingerprint unchanged** (prevents unnecessary simulation restarts on polling)
- **Orchestrator base radius** changed from `10` to `18`
- **Orchestrator node color** is `"#ffffff"` (white) instead of `nodeColor(n.type, n.status)`
- **Orchestrator is pinned** at center with `fx`/`fy`
- **Layout restoration** from sessionStorage with overlap nudging
- **Charge strength** changed from `-300` to `-400`
- **Link distance** changed from `100` to `120`
- **Collide radius** padding changed from `+4` to `+6`
- **alphaDecay** changed from `0.02` to `0` (continuous simulation)
- **alphaTarget** set to `IDLE_ALPHA_TARGET` (0.05) instead of implicit 0
- **velocityDecay** changed from `0.3` to `0.4`
- **Alpha on start** varies based on whether layout is being restored

#### Change F: Orchestrator rendered as square instead of circle

**Current (main) lines 285-288:**
```typescript
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
```

**New:**
```typescript
      ctx.beginPath();
      if (isOrchestrator) {
        // Draw square for orchestrator
        const size = r * 1.8;
        ctx.rect(nx - size / 2, ny - size / 2, size, size);
      } else {
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = node.color;
      ctx.fill();
```

Also adds `const isOrchestrator = node.nodeType === "orchestrator";` to the node rendering block, and adjusts shadow blur to be `12` for orchestrator vs `8` for others (when not hovered/selected).

#### Change G: Hover label formatting

**Current:**
```typescript
      const label = hovered.label;
      const fontSize = 12;
      ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
```

**New:**
```typescript
      const label = hovered.label.toUpperCase();
      const fontSize = 11;
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.letterSpacing = "0.05em";
```

#### Change H: Drag alpha target uses constant

**Current:** `simRef.current?.alphaTarget(0.3).restart();`
**New:** `simRef.current?.alphaTarget(DRAG_ALPHA_TARGET).restart();`

#### Change I: Mouse up alpha target uses constant

**Current:** `simRef.current?.alphaTarget(0);`
**New:** `simRef.current?.alphaTarget(IDLE_ALPHA_TARGET).restart();`

#### Change J: Add node property sync effect (new `useEffect`)

```typescript
  useEffect(() => {
    const nodeMap = new Map(
      Object.values(graphData.nodes).map((n) => [n.id, n])
    );
    for (const simNode of nodesRef.current) {
      const dataNode = nodeMap.get(simNode.id);
      if (dataNode) {
        simNode.status = dataNode.status;
        simNode.color = nodeColor(dataNode.type, dataNode.status);
        simNode.label = dataNode.label;
      }
    }
  }, [graphData]);
```

#### Change K: Add layout persistence on page hide

```typescript
  useEffect(() => {
    const persistLayout = () => {
      saveStoredLayout(prevFingerprintRef.current, nodesRef.current);
    };
    window.addEventListener("pagehide", persistLayout);
    return () => {
      persistLayout();
      window.removeEventListener("pagehide", persistLayout);
    };
  }, []);
```

#### Change L: Lifecycle effect restructured

The single lifecycle effect is split. `buildSim()` is called via its own `useEffect(() => { buildSim(); }, [buildSim])` instead of inside the canvas event listener setup effect.

---

### 5. `frontend/app/globals.css`

**Summary:** Adds custom scrollbar styling for dark theme at the end of the file.

**Append after line 96 (after the closing `}` of `@layer base`):**

```css

/* Custom scrollbar styling - dark theme */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

::-webkit-scrollbar-corner {
  background: transparent;
}
```

**Note:** The actual implementation uses `rgba` values, which differs slightly from the plan's `hsl(var(--muted-foreground) / 0.3)`. The `rgba` approach is simpler and doesn't depend on CSS variable format.

---

## Order of Operations

Apply changes in this order to avoid import/type errors:

1. **`frontend/app/globals.css`** -- Append scrollbar styles (no dependencies)
2. **`frontend/lib/dispatch/state.tsx`** -- Add `runName`, `environment`, `setRunStatus` to state (needed by LeftPanel components)
3. **Create directory** `frontend/components/dispatch/left/`
4. **`frontend/components/dispatch/left/RunMetricsGrid.tsx`** -- Create (no cross-dependencies within `left/`)
5. **`frontend/components/dispatch/left/FindingsListCard.tsx`** -- Create (no cross-dependencies within `left/`)
6. **`frontend/components/dispatch/left/PreReconCard.tsx`** -- Create (no cross-dependencies within `left/`)
7. **`frontend/components/dispatch/left/RunHeader.tsx`** -- Create (depends on `StatusBadge` which already exists on main)
8. **`frontend/components/dispatch/left/LeftPanel.tsx`** -- Create (imports all 4 components above)
9. **`frontend/components/dispatch/DispatchWorkspace.tsx`** -- Modify to add LeftPanel (depends on step 8)
10. **`frontend/components/dispatch/graph/GraphWorkspace.tsx`** -- Modify legend (independent)
11. **`frontend/lib/dispatch/useForceGraph.ts`** -- Modify force graph (independent, can be done anytime)

Steps 4-7 can be done in any order. Steps 10-11 are independent of all other steps.

---

## Potential Conflicts

### 1. `Card` component `size` prop
The `FindingsListCard` and `PreReconCard` both use `<Card size="sm">`. Verify that the shadcn/ui `Card` component on main supports a `size` prop. If not, either:
- Remove the `size="sm"` prop
- Add size variant support to the Card component

### 2. `GraphWorkspace.tsx` legend colors
Main uses Tailwind class names (`bg-status-running`, `bg-primary`, etc.) with `className` for legend dots. The worktree uses inline `style={{ backgroundColor: color }}` with hex values. If custom status color classes (`bg-status-running`, `bg-status-error`, etc.) exist in the Tailwind config on main, this change removes their usage from the legend. This is intentional (hardcoded hex values match the canvas rendering colors exactly).

### 3. `useForceGraph.ts` is substantially rewritten
The worktree version is a near-complete rewrite with layout persistence, fingerprinting, orchestrator special rendering, and simulation parameter changes. If any other changes were made to `useForceGraph.ts` on main since `d3e0ea8`, they will likely conflict. The safest approach is to replace the entire file with the worktree version.

### 4. `state.tsx` interface change
The `DispatchWorkspaceState` interface gains `runName` and `environment` fields. Any other code consuming this interface will now have access to these fields. No breaking change -- purely additive.

### 5. `Separator` unused import in RunHeader
The `Separator` component is imported in `RunHeader.tsx` but never used. This will trigger a lint warning if the project has `no-unused-vars` or similar rules. Consider removing it.

# Sidebar UI Merge Design

**Date:** 2026-03-14
**Status:** Approved
**Branch:** `arsh-frontend-ui` → `main`

## Overview

Selectively merge UI and stylistic changes from `arsh-frontend-ui` branch into `main`, adding a left sidebar panel while ensuring only real backend-connected data is displayed. All hardcoded/mock data components are excluded.

## Goals

1. Add left sidebar panel with real-time data display
2. Keep only components that use data from `DispatchOutput`
3. Remove all hardcoded/mock data patterns
4. Maintain the clean architecture established in `main`

## Backend Data Contract

The sidebar will display data from `DispatchOutput` (defined in `backend/src/orchestrator/graph-types.ts`):

```typescript
interface DispatchOutput {
  dispatch_run_id: string;
  status: RunStatus;
  started_at: string;
  completed_at?: string;
  triggered_by?: TriggeredBy;
  repo: { name: string; url?: string };
  pre_recon?: PreReconDeliverable;
  task_assignments: TaskAssignment[];
  finding_reports: FindingReport[];
  findings: Finding[];
  metrics: RunMetrics;
  graph_data?: GraphData;
}
```

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────┐ ┌────────────────┐  │
│ │LeftPanel │ │    GraphWorkspace      │ │ NodeInspector  │  │
│ │  360px   │ │       (flex-1)         │ │   Sidebar      │  │
│ │          │ │                        │ │                │  │
│ │ - Header │ │                        │ │                │  │
│ │ - Recon  │ │                        │ │                │  │
│ │ - Findngs│ │                        │ │                │  │
│ │ - Metrics│ │                        │ │                │  │
│ └──────────┘ └────────────────────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Components to Merge (Real Data)

| Component | Data Source | Purpose |
|-----------|-------------|---------|
| `LeftPanel.tsx` | Container | Main sidebar container (simplified to 4 sections) |
| `RunHeader.tsx` | `repo.name`, `status`, `isLoading`, `lastUpdated` | Run name, status badge, sync indicator |
| `PreReconCard.tsx` | `pre_recon` | Routes, risk signals, dependencies, briefing |
| `FindingsListCard.tsx` | `findings[]` | Finding list with severity, status |
| `RunMetricsGrid.tsx` | `metrics` | Routes, workers, findings, tickets, PRs counts |

### Components Excluded (No Backend Data)

| Component | Reason |
|-----------|--------|
| `OrchestratorSpecCard.tsx` | Uses `OrchestratorSpec` with `frameworks`, `integrations`, `workerTypes`, `priorities` - not in `DispatchOutput` |
| `SetupAccordion.tsx` | 100% hardcoded content |
| `OrchestratorPlanFeed.tsx` | Uses `PlanPreviewItem[]` - type doesn't exist in backend |

## State Changes

### Fields to Add

```typescript
// In DispatchWorkspaceState
runName: string;      // Derived from repo.name
environment: string;  // Default "staging" or derived

// In context value
setRunStatus: (status: RunStatus) => void;
```

### Data Flow

1. `refreshData()` fetches `/dispatch-output.json`
2. `loadDispatchOutput()` populates state from response
3. `runName` derived from `repo.name`
4. No mock data functions - empty/null defaults only

## Files to Modify

| File | Action |
|------|--------|
| `components/dispatch/DispatchWorkspace.tsx` | Add LeftPanel import and render |
| `components/dispatch/left/LeftPanel.tsx` | Create (simplified 4-section version) |
| `components/dispatch/left/RunHeader.tsx` | Create |
| `components/dispatch/left/PreReconCard.tsx` | Create |
| `components/dispatch/left/FindingsListCard.tsx` | Create |
| `components/dispatch/left/RunMetricsGrid.tsx` | Create |
| `lib/dispatch/state.tsx` | Add `runName`, `environment`, `setRunStatus` |
| `app/globals.css` | Add scrollbar styling |
| `components/ui/scroll-area.tsx` | Minor style tweaks |

## Styling Changes

- Webkit scrollbar styling (track, thumb)
- `.scroll-mt-4` utility class
- Graph edge colors (gray instead of green)

## Implementation Notes

1. **LeftPanel simplification:** Remove section navigation buttons for excluded sections (Overview, Setup, Plan)
2. **RunHeader:** Use `repo.name` instead of hardcoded `runName`
3. **Empty state handling:** Components should gracefully handle null/empty data
4. **No mock functions:** Remove all `getMock*()` functions from state.tsx

## Testing Checklist

- [ ] Sidebar renders with real dispatch-output.json data
- [ ] PreReconCard displays routes, risk signals, dependencies
- [ ] FindingsListCard handles empty findings array gracefully
- [ ] RunMetricsGrid shows actual metrics values
- [ ] RunHeader shows repo name and status from backend
- [ ] No hardcoded data visible in UI

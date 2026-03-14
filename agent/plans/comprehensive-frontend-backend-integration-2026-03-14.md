# Comprehensive Frontend–Backend Integration Plan

> **Generated:** 2026-03-14  
> **Updated:** Plan revision — remove HUD, graph-centric UX  
> **Approach:** Graph-only UI, inspector-driven detail, backend-backed node info

---

## 1. Executive Summary

**New direction:** Remove all HUD/clutter. Keep **only the graph view** as the core. Build a clean, graph-centric UX where the user clicks an agent node and sees **exactly what it is doing** — using real backend data. No obligation to preserve existing panels or components.

---

## 2. Remove HUD — What Goes Away

| Component | Reason |
|-----------|--------|
| **Left panel (entire)** | Clutter; many widgets require data backend doesn't export or that adds noise |
| **RunHeader** | runName, environment, status — not essential for graph-centric flow |
| **OrchestratorSpecCard** | Backend doesn't export orchestrator spec |
| **SetupAccordion** | Setup/config UI; not needed for viewing scan state |
| **PreReconCard** | Pre-recon summary; can surface in orchestrator node inspector instead |
| **OrchestratorPlanFeed** | Phase timeline; can surface in orchestrator node inspector |
| **FindingsListCard** | Findings list; can surface via finding nodes in graph + inspector |
| **RunMetricsGrid** | Aggregate metrics; not essential for node-centric UX |
| **GraphToolbar** (search, filters) | Filters (showCriticalPath, showFailedOnly, etc.) may require data we don't have; simplify or remove |
| **GraphLegend** | Simplify or inline; avoid standalone HUD block |

---

## 3. What Stays & Builds On

### 3.1 Core: Graph View

- **GraphCanvas** — full-width, primary focus
- **Node types:** orchestrator, cluster, worker, finding
- **Click node → Inspector** shows what that node is doing

### 3.2 Inspector (Node Detail Panel)

The inspector is the **primary way to get information**. It must show **exactly** what each node is doing, using **only backend-exported data**.

| Node Type | Backend Data Available | Inspector Should Show |
|-----------|------------------------|------------------------|
| **Orchestrator** | `status`, `pre_recon` (route_map, risk_signals, briefing_notes), `task_assignments` count | What it's coordinating: routes discovered, risk signals, current phase, briefing |
| **Cluster** | `task_assignments` filtered by attack_type | Workers in this cluster; attack type; list of assigned endpoints |
| **Worker** | `task_assignments` (briefing, target, attack_type, context), `finding_reports` (status, duration, findings, clean_endpoints) | **Exactly what it's doing:** briefing text, target endpoint, attack type, status, duration, findings/clean endpoints from its report |
| **Finding** | `finding` in node meta (from `finding_reports`) | Full finding details: severity, vuln type, location, reproduction, recommended fix |

### 3.3 Minimal Chrome (Optional)

- **Zoom/pan controls** — fit to screen, reset view (if useful)
- **Empty state** — "No scan data" when fetch fails, with hint to run `pnpm tsx src/cli.ts scan <path>`
- **Minimal legend** — e.g. status colors, only if it adds value

---

## 4. Backend Data Requirements

The backend already exports what we need. No new fields required for the simplified UX.

| Data | Used For |
|------|----------|
| `graph_data` | Render nodes and edges |
| `task_assignments` | Worker inspector: briefing, target, attack_type, context |
| `finding_reports` | Worker inspector: status, duration, findings, clean_endpoints |
| `pre_recon` | Orchestrator inspector: route_map, risk_signals, briefing_notes |
| `findings` | Finding nodes (via graph_data node meta) |

**Optional backend enhancement:** Attach `assignment` to worker nodes in `graph_data.nodes[id].meta` so the frontend doesn't need to look up by `worker_id`. Same for orchestrator: attach `pre_recon` to orchestrator node meta.

---

## 5. Implementation Tasks (Revised)

### Phase 1: Remove HUD

| Task | Description |
|------|-------------|
| 1.1 | Remove left panel entirely (LeftPanel, RunHeader, OrchestratorSpecCard, SetupAccordion, PreReconCard, OrchestratorPlanFeed, FindingsListCard, RunMetricsGrid) |
| 1.2 | Remove or simplify GraphToolbar (drop search, filters; keep only zoom/pan if desired) |
| 1.3 | Simplify or remove GraphLegend |
| 1.4 | Update DispatchWorkspace layout: graph full-width, inspector as slide-over or right sidebar |

### Phase 2: Inspector — "Exactly What It's Doing"

| Task | Description |
|------|-------------|
| 2.1 | **Worker node:** Look up `task_assignments` + `finding_reports` by `worker_id`. Show: briefing, target (endpoint, method, file), attack_type, status, duration, findings count, clean_endpoints |
| 2.2 | **Orchestrator node:** Show `pre_recon` — routes count, risk signals (expandable), briefing_notes |
| 2.3 | **Cluster node:** Show workers in cluster (from task_assignments), attack type, assigned endpoints |
| 2.4 | **Finding node:** Keep FindingDetailsCard; ensure it uses only backend finding shape |
| 2.5 | Remove mock/default events and assets; show only real data or "No data" |

### Phase 3: Optional Backend Enhancements

| Task | Description |
|------|-------------|
| 3.1 | Attach `assignment` to worker node `meta` in graph-builder |
| 3.2 | Attach `pre_recon` summary to orchestrator node `meta` |
| 3.3 | Attach cluster worker list to cluster node `meta` |

### Phase 4: Empty State & Polish

| Task | Description |
|------|-------------|
| 4.1 | When no data: full-width empty state — "No scan data. Run: pnpm tsx src/cli.ts scan <path>" |
| 4.2 | Ensure inspector empty state is minimal when no node selected |

---

## 6. Target Layout

```
┌─────────────────────────────────────────────────────────────┬──────────────┐
│                                                             │   Inspector  │
│                      Graph (full width)                     │   (slide or  │
│                                                             │   sidebar)   │
│   [Orchestrator] ── [Cluster] ── [Worker] ── [Finding]      │              │
│                                                             │   Click node │
│   [optional: minimal zoom/pan]                               │   → details  │
│                                                             │              │
└─────────────────────────────────────────────────────────────┴──────────────┴
```

---

## 7. Data Flow (Unchanged)

```
Backend CLI scan → dispatch-output.json
Frontend poll (2s) → loadDispatchOutput
State: graphData, task_assignments, finding_reports, pre_recon, findings
Click node → Inspector looks up by node type + id → render backend data
```

---

## 8. Checklist (Revised)

- [ ] Remove left panel (all HUD components)
- [ ] Remove/simplify GraphToolbar and GraphLegend
- [ ] Update DispatchWorkspace layout (graph + inspector only)
- [ ] Worker inspector: show briefing, target, report from task_assignments + finding_reports
- [ ] Orchestrator inspector: show pre_recon (routes, risk signals, briefing)
- [ ] Cluster inspector: show workers and endpoints in cluster
- [ ] Finding inspector: keep FindingDetailsCard, backend-backed
- [ ] Empty state when no scan data
- [ ] (Optional) Backend: attach assignment/pre_recon to node meta

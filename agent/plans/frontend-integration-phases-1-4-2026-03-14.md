# Frontend Integration — Phases 1–4 Plan

> **Created:** 2026-03-14  
> **Scope:** HUD removal, inspector real-data wiring, optional backend meta, empty states

---

## Phase 1: Remove HUD

| Task | Description |
|------|-------------|
| 1.1 | Remove left panel entirely (LeftPanel, RunHeader, OrchestratorSpecCard, SetupAccordion, PreReconCard, OrchestratorPlanFeed, FindingsListCard, RunMetricsGrid) |
| 1.2 | Remove or simplify GraphToolbar (drop search, filters; keep only zoom/pan if desired) |
| 1.3 | Simplify or remove GraphLegend |
| 1.4 | Update DispatchWorkspace layout: graph full-width, inspector as slide-over or right sidebar |

---

## Phase 2: Inspector — Backed by Real Data

| Task | Description |
|------|-------------|
| 2.1 | **Worker node:** Look up `task_assignments` + `finding_reports` by `worker_id`. Show: briefing, target (endpoint, method, file), attack_type, status, duration, findings count, clean_endpoints |
| 2.2 | **Orchestrator node:** Show `pre_recon` — routes count, risk signals (expandable), briefing_notes |
| 2.3 | **Cluster node:** Show workers in cluster (from task_assignments), attack type, assigned endpoints |
| 2.4 | **Finding node:** Keep FindingDetailsCard; ensure it uses only backend finding shape |
| 2.5 | Remove mock/default events and assets; show only real data or "No data" |

---

## Phase 3: Optional Backend Enhancements

| Task | Description |
|------|-------------|
| 3.1 | Attach `assignment` to worker node `meta` in graph-builder |
| 3.2 | Attach `pre_recon` summary to orchestrator node `meta` |
| 3.3 | Attach cluster worker list to cluster node `meta` |

---

## Phase 4: Empty State & Polish

| Task | Description |
|------|-------------|
| 4.1 | When no data: full-width empty state — "No scan data. Run: pnpm tsx src/cli.ts scan <path>" |
| 4.2 | Ensure inspector empty state is minimal when no node selected |

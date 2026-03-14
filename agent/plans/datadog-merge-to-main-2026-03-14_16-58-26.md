# Datadog Integration — Merge to Main Plan

> **Created:** 2026-03-14
> **Status:** Planning
> **Scope:** Get all Datadog integration code merged into `main`

---

> **PREREQUISITE — Before executing any phase of this plan, run the `/prime` command to initialize your understanding of the codebase architecture. Do not proceed until priming is complete.**

---

## Clarification Questions

None. The implementation is nearly complete. All Datadog modules exist, the middleware is updated, and the collector has `forwardToDatadog()` built. The remaining work is wiring, testing, and validation.

---

## Current State Audit

### Already Implemented

| File | Status | Notes |
|---|---|---|
| `backend/src/integrations/datadog/types.ts` | **Done** | All payload types defined |
| `backend/src/integrations/datadog/client.ts` | **Done** | `sendLogs`, `searchLogs`, `sendEvent`, `sendMetrics`, `initDatadog`, `isEnabled`, `isReadEnabled`, `resetConfig` |
| `backend/src/integrations/datadog/log-forwarder.ts` | **Done** | Batching buffer (100 entries / 5s), `enqueue`, `flush`, `shutdown` |
| `backend/src/integrations/datadog/log-reader.ts` | **Done** | `queryLogs` — builds Datadog search query, maps results to `DispatchLogEntry` |
| `backend/src/integrations/datadog/__tests__/client.test.ts` | **Done** | Covers init, sendLogs, searchLogs, sendEvent, sendMetrics |
| `backend/src/integrations/datadog/__tests__/log-forwarder.test.ts` | **Done** | Covers enqueue, flush, batch threshold, shutdown, no-op when disabled |
| `backend/src/integrations/datadog/__tests__/log-reader.test.ts` | **Done** | Covers query building, result mapping, filter params, error fallback |
| `backend/src/middleware/types.ts` | **Done** | Added `dispatch_worker_id?` and `dispatch_run_id?` fields to `DispatchLogEntry` |
| `backend/src/middleware/dispatch-log-middleware.ts` | **Done** | Imports datadog client/forwarder/reader, calls `initDatadog()`, `startAutoFlush()`, `enqueue()` in `addLog()`, Datadog read proxy in `handleLogQuery()` |
| `backend/src/orchestrator/collector.ts` | **Done** | Imports `isEnabled`, `sendEvent`, `sendMetrics`. Has `forwardToDatadog(report)` fully built — sends Event + 6 Metrics series |

### NOT Done

| Item | What's Missing |
|---|---|
| **Orchestrator call site** | `agent.ts` imports `mergeReports` but never calls `forwardToDatadog(mergedReport)` after merge |
| **Collector tests for `forwardToDatadog`** | `collector.test.ts` only tests `mergeReports` — no tests for the Datadog forwarding function |
| **Middleware test updates** | Existing middleware tests may break due to new top-level imports (`initDatadog`, `startAutoFlush`, etc.) |
| **`.env.example`** | No env var documentation for `DATADOG_API_KEY`, `DD_SITE`, `DD_ENV`, `DD_SERVICE`, `DD_APPLICATION_KEY` |
| **Full test suite pass** | Need to verify all existing tests still pass with the new imports and module-level `initDatadog()` call |

---

## Dependency Map

```
types.ts  (no deps)
    ↓
client.ts  (depends on types.ts, env vars)
    ↓
log-forwarder.ts  (depends on client.ts, types.ts, middleware/types.ts)
log-reader.ts     (depends on client.ts, types.ts)
    ↓
dispatch-log-middleware.ts  (depends on all three above)
collector.ts → forwardToDatadog()  (depends on client.ts, types.ts)
    ↓
orchestrator/agent.ts  (calls forwardToDatadog after mergeReports)
```

**Blockers:** None. All dependencies are internal. Datadog API is fire-and-forget — no external blocker.

---

## Phase 1: MVP — Wire the Call Site + Fix Tests (Merge-blocking)

### Task 1.1: Wire `forwardToDatadog` in orchestrator agent

**File:** `backend/src/orchestrator/agent.ts`

**Change:** After line 98 (`mergedReport = mergeReports(completedReports)`), add:

```typescript
import { forwardToDatadog } from './collector';
// ... after mergeReports():
await forwardToDatadog(mergedReport);
```

Note: `forwardToDatadog` is already fire-and-forget internally (errors logged, never thrown), so this won't block the pipeline. The `await` is just to ensure the event/metrics POST completes before the process exits.

**Verify:** `forwardToDatadog` import is added, called only when `mergedReport` is non-null (it's already inside the `if (completedReports.length > 0)` block).

### Task 1.2: Fix middleware tests for new top-level side effects

**File:** `backend/src/middleware/__tests__/dispatch-log-middleware.test.ts`

**Issue:** The middleware now calls `initDatadog()` and conditionally `startAutoFlush()` at module load time. Tests need to mock the datadog modules to prevent real initialization.

**Change:** Add `vi.mock` for `../integrations/datadog/client.js`, `../integrations/datadog/log-forwarder.js`, and `../integrations/datadog/log-reader.js` at the top of the test file, returning no-op stubs.

### Task 1.3: Add `forwardToDatadog` tests to collector test suite

**File:** `backend/src/orchestrator/__tests__/collector.test.ts`

**Changes:**
- Mock `../integrations/datadog/client.js` (mock `isEnabled`, `sendEvent`, `sendMetrics`)
- Add tests for `forwardToDatadog`:
  - No-op when `isEnabled()` returns false
  - Sends event with correct `alert_type: 'error'` when critical findings > 0
  - Sends event with `alert_type: 'warning'` when only high findings
  - Sends event with `alert_type: 'info'` when only medium/low
  - Sends 6 metric series with correct values from summary
  - Calls `sendEvent` and `sendMetrics` in parallel (`Promise.all`)
  - Tags include `dispatch_run_id`

### Task 1.4: Run full test suite

```bash
cd backend && pnpm test
```

**Success criteria:** All existing tests pass + new tests pass. Zero regressions.

### Task 1.5: Add env vars to `.env.example`

**File:** `backend/.env.example` (create if doesn't exist)

```
# Datadog Integration (optional — all forwarding is no-op when DATADOG_API_KEY is absent)
DATADOG_API_KEY=       # Required for Datadog forwarding
DD_APPLICATION_KEY=    # Optional — enables reading logs back from Datadog
DD_SITE=datadoghq.com # Optional — Datadog site (default: datadoghq.com)
DD_ENV=development     # Optional — environment tag (default: dispatch)
DD_SERVICE=dispatch    # Optional — service name (default: dispatch-scanner)
```

---

## Phase 2: Hardening (Post-merge, pre-demo)

### Task 2.1: Graceful handling when `initDatadog` runs outside middleware context

The middleware calls `initDatadog()` at module import time. If `collector.ts` is imported in a context where the middleware hasn't been loaded yet (e.g., standalone report generation via `pnpm report`), `isEnabled()` in the collector will return false because `initDatadog()` hasn't run. Verify this is acceptable — the collector's `forwardToDatadog` already guards on `isEnabled()`, so it's a safe no-op. But consider whether the orchestrator should also call `initDatadog()` early in `runOrchestrator()` to ensure it's initialized regardless of import order.

### Task 2.2: Verify preload script compatibility

The `dispatch-preload.js` injects middleware into target apps via `node -r`. When the middleware is injected this way, `initDatadog()` runs in the target app's process. Verify that `DATADOG_API_KEY` is passed through the worker's env in `setup.ts` (it currently passes `process.env` spread, so this should work). Confirm with a manual test.

### Task 2.3: Add `dispatch.risk_score` metric

The plan mentions `dispatch.risk_score` (0-10 float) but the current `forwardToDatadog` implementation sends 6 metrics and does NOT include risk score. Either add it or remove it from the plan.

---

## Phase 3: Optimization (Nice-to-have)

### Task 3.1: Datadog dashboard JSON template

Pre-built dashboard definition that users can import into their Datadog account. Shows finding counts over time, severity breakdown, scan duration trends.

### Task 3.2: Log-based alerting for findings

Send individual findings as Datadog Logs (in addition to the summary Event) so users can create log-based monitors like "alert when `dispatch.findings.critical > 0`".

### Task 3.3: Rate limiting on log forwarder

Cap log forwarding if a scan produces thousands of entries. Current batch size is 100 with 5s flush — probably fine, but add a max buffer size to prevent memory growth.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Module-level `initDatadog()` side effect breaks test isolation | Medium | Mock the datadog modules in all test files that import the middleware |
| `forwardToDatadog` await delays process exit | Low | Already fire-and-forget; add a reasonable timeout (5s) on the await if needed |
| Import order means `isEnabled()` is false in collector context | Low | Collector guards on `isEnabled()`; consider calling `initDatadog()` in orchestrator |
| Middleware test file doesn't mock new imports | High (blocks merge) | Phase 1 Task 1.2 addresses this directly |
| Preload script doesn't pass DD env vars to target app | Low | `setup.ts` spreads `process.env`; verify in Phase 2 |

---

## Success Criteria

### Phase 1 (Merge-ready)
- [ ] `forwardToDatadog(mergedReport)` is called in `agent.ts` after `mergeReports()`
- [ ] `pnpm test` passes with 0 failures
- [ ] New tests cover `forwardToDatadog` (no-op when disabled, correct event/metrics when enabled)
- [ ] Middleware tests pass with mocked datadog modules
- [ ] `.env.example` documents all DD env vars

### Phase 2 (Demo-ready)
- [ ] Manual scan with `DATADOG_API_KEY` set shows logs in Datadog Logs Explorer
- [ ] Scan completion Event appears in Datadog Events
- [ ] Metrics appear in Datadog Metrics Explorer
- [ ] Scan without `DATADOG_API_KEY` works identically to before (zero overhead)

---

## Suggested Tests

### `collector.test.ts` — new tests for `forwardToDatadog`

```
forwardToDatadog
  ✓ should be a no-op when isEnabled returns false
  ✓ should send event with alert_type error when critical findings exist
  ✓ should send event with alert_type warning when only high findings
  ✓ should send event with alert_type info when only medium/low findings
  ✓ should include finding counts in event text
  ✓ should send 6 metric series with correct values
  ✓ should tag event and metrics with dispatch_run_id
  ✓ should call sendEvent and sendMetrics (both called)
```

### `dispatch-log-middleware.test.ts` — verify no regression

```
dispatchLogMiddleware (with mocked datadog)
  ✓ existing tests still pass (log capture, query endpoint, filtering)
  ✓ enqueue is called when worker headers are present
  ✓ enqueue is not called when no worker headers
  ✓ handleLogQuery proxies to Datadog when readEnabled
  ✓ handleLogQuery falls back to in-memory when Datadog fails
```

---

## Impacted Files

| File | Action | Phase |
|---|---|---|
| `backend/src/orchestrator/agent.ts` | **Modify** — add `forwardToDatadog` call | 1 |
| `backend/src/orchestrator/__tests__/collector.test.ts` | **Modify** — add `forwardToDatadog` tests | 1 |
| `backend/src/middleware/__tests__/dispatch-log-middleware.test.ts` | **Modify** — add datadog mocks | 1 |
| `backend/.env.example` | **Create** | 1 |
| `backend/src/orchestrator/agent.ts` | **Verify** — `initDatadog()` call order | 2 |
| `backend/src/workers/pentester/setup.ts` | **Verify** — env passthrough | 2 |
| `backend/src/orchestrator/collector.ts` | **Maybe modify** — add risk_score metric | 2 |

---

> **COMMIT PROTOCOL — When implementation is complete, launch a `commit-architect` sub-agent instance (via the Task tool with `subagent_type="commit-architect"`) to analyze your changes and produce clean, atomic Conventional Commits. Do not write commits manually.**

# Datadog Forwarding — Implementation Plan

> **Created:** 2026-03-14
> **Status:** Planning
> **Plan ref:** Task 3.2 from master plan

---

## Goal

Forward Dispatch log middleware output and scan findings to Datadog so teams can monitor security scans in their existing observability stack — dashboards, alerts, and log search.

---

## Current State

The middleware (`backend/src/middleware/dispatch-log-middleware.ts`) captures logs into an **in-memory Map** keyed by `worker_id`. Logs are:
- Written on every request with `X-Dispatch-Worker-Id` header
- Queryable via `GET /_dispatch/logs?worker_id=...`
- Structured as `{ timestamp, level, source, message, stack? }`

There is **no Datadog integration anywhere** in the codebase today.

---

## What Needs to Happen

Two integration surfaces:

### Surface 1: Log Forwarding (middleware → Datadog Logs API)

When `DATADOG_API_KEY` is set, the middleware should **dual-write** each log entry — keep it in the in-memory store (pentester workers still read from `/_dispatch/logs`) AND forward it to Datadog's Log Intake API.

**Approach:** Add a `forwardToDatadog()` call inside the existing `addLog()` closure. Buffer logs and flush in batches (max 5MB or every 5s) to avoid per-log HTTP overhead.

**Tags on every log:**
- `dispatch_run_id` (from `X-Dispatch-Run-Id` header)
- `dispatch_worker_id` (from `X-Dispatch-Worker-Id` header)
- `source` (console, express, db)
- `env` (from `DD_ENV` or default `dispatch`)
- `service` (from `DD_SERVICE` or default `dispatch-scanner`)

**Datadog Logs API endpoint:**
- `POST https://http-intake.logs.datadoghq.com/api/v2/logs`
- Header: `DD-API-KEY: <key>`
- Body: array of log objects with `message`, `ddsource`, `ddtags`, `hostname`, `service`

### Surface 2: Findings as Events/Metrics (collector → Datadog Events API)

After the collector merges reports, post a **Datadog Event** summarizing the scan, plus **custom metrics** for dashboard widgets.

**Event (per scan run):**
- Title: `Dispatch Scan Complete: {dispatch_run_id}`
- Text: severity breakdown, top findings, worker errors
- Tags: `dispatch_run_id`, severity counts
- Alert type: `error` if critical findings, `warning` if high, `info` otherwise

**Custom metrics (gauge, per scan):**
- `dispatch.findings.critical` — count
- `dispatch.findings.high` — count
- `dispatch.findings.medium` — count
- `dispatch.findings.low` — count
- `dispatch.risk_score` — 0-10 float
- `dispatch.scan.duration_seconds` — scan time
- `dispatch.scan.workers` — worker count

**Datadog Events API:** `POST https://api.datadoghq.com/api/v1/events`
**Datadog Metrics API:** `POST https://api.datadoghq.com/api/v2/series`

---

## Implementation Steps

### Step 1: Datadog Client Module
`backend/src/integrations/datadog/client.ts`

- Reads `DATADOG_API_KEY` from env (required) and `DD_SITE` (optional, default `datadoghq.com`)
- Exposes: `isEnabled()`, `sendLogs(entries)`, `sendEvent(event)`, `sendMetrics(series)`
- All calls are fire-and-forget with error logging (never block the scan pipeline)
- Uses native `fetch` — no SDK dependency needed

### Step 2: Log Forwarder
`backend/src/integrations/datadog/log-forwarder.ts`

- Implements a batching buffer: accumulates log entries, flushes when batch hits 100 entries or 5 seconds elapse
- `enqueue(entry, runId, workerId)` — adds to buffer with tags
- `flush()` — sends batch via `client.sendLogs()`
- `shutdown()` — flushes remaining and clears interval
- Transforms `DispatchLogEntry` → Datadog log format

### Step 3: Hook into Middleware
`backend/src/middleware/dispatch-log-middleware.ts`

- Import log forwarder
- In `addLog()`, after pushing to `workerLogs`, call `forwarder.enqueue(entry, runId, workerId)` if Datadog is enabled
- On process exit, call `forwarder.shutdown()`
- **No behavior change** when `DATADOG_API_KEY` is not set

### Step 4: Hook into Collector
`backend/src/orchestrator/collector.ts`

- After `mergeReports()` returns, if Datadog is enabled:
  - Send event with scan summary
  - Send metric series with finding counts and risk score
- Add a `forwardToDatadog(report: MergedReport)` function

### Step 5: Env Vars
Add to `.env.example`:
```
DATADOG_API_KEY=       # Optional — enables Datadog log/metric forwarding
DD_SITE=datadoghq.com # Optional — Datadog site (default: datadoghq.com)
DD_ENV=development     # Optional — environment tag
DD_SERVICE=dispatch    # Optional — service name tag
```

---

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `backend/src/integrations/datadog/client.ts` | **Create** | Datadog API client (logs, events, metrics) |
| `backend/src/integrations/datadog/log-forwarder.ts` | **Create** | Batching log forwarder |
| `backend/src/integrations/datadog/types.ts` | **Create** | Datadog payload types |
| `backend/src/integrations/datadog/__tests__/client.test.ts` | **Create** | Client unit tests |
| `backend/src/integrations/datadog/__tests__/log-forwarder.test.ts` | **Create** | Forwarder unit tests |
| `backend/src/middleware/dispatch-log-middleware.ts` | **Modify** | Add forwarder.enqueue() call in addLog() |
| `backend/src/orchestrator/collector.ts` | **Modify** | Add event/metrics forwarding after merge |

---

## Design Decisions

1. **No SDK** — Datadog's HTTP APIs are simple enough that native `fetch` avoids a heavy dependency. The log intake, events, and metrics APIs are each a single POST endpoint.

2. **Fire-and-forget** — Datadog calls never block or fail the scan. Errors are logged to console but swallowed.

3. **Batching** — Log-per-HTTP-request would be wasteful. Buffer up to 100 entries or 5s, whichever comes first.

4. **Dual-write, not replace** — The in-memory store stays. Pentester workers still read from `/_dispatch/logs`. Datadog is a secondary destination.

5. **Gated on env var** — Zero overhead when `DATADOG_API_KEY` is absent. No conditional imports — the forwarder's `enqueue()` is a no-op when disabled.

---

## Test Strategy

- **Client tests:** Mock `fetch`, verify correct URL/headers/body for each API endpoint. Verify no-op when API key missing.
- **Forwarder tests:** Verify batching (entries accumulate, flush at threshold). Verify flush on shutdown. Verify tag enrichment.
- **Integration:** Verify middleware still works identically when Datadog is disabled. Verify `addLog()` calls forwarder when enabled.

---

## Open Questions

- [ ] Do we want a Datadog dashboard JSON template (pre-built dashboard for Dispatch metrics)?
- [ ] Should findings also be sent as Datadog Logs (in addition to events) for log-based alerting?
- [ ] Rate limiting — should we cap log forwarding if a scan produces thousands of entries?

# Agent Diagnostics API — Frontend Developer Guide

Use these endpoints to display real-time agent health, detect infinite loops, and inspect per-worker behavior during a Dispatch scan run.

---

## Quick Start

```typescript
// Fetch all diagnostics, sorted by trace length (descending)
const res = await fetch("/api/diagnostics");
const { workers } = await res.json();
const sorted = workers.sort((a, b) => b.trace_length - a.trace_length);

// Filter to only pentester agents
const pentesters = await fetch("/api/diagnostics?type=pentester").then(r => r.json());

// Check for looping agents
const { alerts } = await fetch("/api/diagnostics/alerts").then(r => r.json());
```

---

## Endpoints

### `GET /api/diagnostics`

Returns diagnostics for all active workers.

**Query Parameters**

| Param    | Type                            | Description                          |
|----------|---------------------------------|--------------------------------------|
| `type`   | `pentester` \| `constructor`    | Filter by subagent type              |
| `sort`   | field name (e.g. `trace_length`)| Sort by any numeric field, descending|
| `status` | `running` \| `completed` \| `error` | Filter by worker status         |

**Response `200 OK`**

```json
{
  "workers": [AgentDiagnostics],
  "count": 5
}
```

**Example: get pentester agents sorted by wall clock time**

```
GET /api/diagnostics?type=pentester&sort=wall_clock_seconds
```

---

### `GET /api/diagnostics/:worker_id`

Returns diagnostics for a single worker.

**Response `200 OK`**

```json
{
  "worker_id": "pentester-sqli-login-01",
  "worker_type": "pentester",
  "dispatch_run_id": "run-2026-03-14-001",
  "started_at": "2026-03-14T10:05:00.000Z",
  "updated_at": "2026-03-14T10:07:32.000Z",
  "wall_clock_seconds": 152,
  "trace_length": 34,
  "tool_calls": {
    "Bash": 18,
    "Read": 8,
    "Edit": 5,
    "Grep": 3
  },
  "total_tool_calls": 34,
  "lines_added": 42,
  "lines_removed": 7,
  "unique_files_touched": ["src/routes/login.ts", "src/db/users.ts"],
  "repeated_calls": 2,
  "error_count": 1,
  "consecutive_errors": 0,
  "phase": "monkeypatching",
  "findings_so_far": 2,
  "last_action": "Edit src/routes/login.ts - parameterized query fix",
  "health_status": "healthy"
}
```

**Response `404 Not Found`** — worker_id not found in active diagnostics.

---

### `GET /api/diagnostics/alerts`

Returns workers flagged as looping or unhealthy.

**Query Parameters**

| Param  | Type                          | Description              |
|--------|-------------------------------|--------------------------|
| `type` | `pentester` \| `constructor`  | Filter by subagent type  |

**Response `200 OK`**

```json
{
  "alerts": [
    {
      "worker_id": "pentester-xss-profile-03",
      "worker_type": "pentester",
      "dispatch_run_id": "run-2026-03-14-001",
      "triggered_at": "2026-03-14T10:12:45.000Z",
      "reasons": ["high_repetition_ratio", "trace_length_exceeded"],
      "confidence": "high",
      "diagnostics": { ... },
      "auto_killed": true
    }
  ],
  "count": 1
}
```

---

## Data Schemas

### `AgentDiagnostics`

| Field                  | Type                    | Description                                            |
|------------------------|-------------------------|--------------------------------------------------------|
| `worker_id`            | `string`                | Unique worker identifier                               |
| `worker_type`          | `"pentester" \| "constructor"` | Subagent type — use for filtering/sorting       |
| `dispatch_run_id`      | `string`                | Parent scan run ID                                     |
| `started_at`           | `string` (ISO 8601)     | When the worker started                                |
| `updated_at`           | `string` (ISO 8601)     | Last diagnostics update (staleness indicator)          |
| `wall_clock_seconds`   | `number`                | Seconds since worker started                           |
| `trace_length`         | `number`                | Conversation turns (tool calls made)                   |
| `tool_calls`           | `Record<string, number>`| Breakdown by tool name: `{ "Bash": 12, "Edit": 3 }`   |
| `total_tool_calls`     | `number`                | Sum of all tool calls                                  |
| `lines_added`          | `number`                | Total lines added across all edits                     |
| `lines_removed`        | `number`                | Total lines removed across all edits                   |
| `unique_files_touched` | `string[]`              | Unique file paths edited or read                       |
| `repeated_calls`       | `number`                | Tool calls with identical tool+args as a previous call |
| `error_count`          | `number`                | Total tool call errors                                 |
| `consecutive_errors`   | `number`                | Errors in a row without a success (resets on success)  |
| `phase`                | `string`                | Current agent phase: `"attacking"`, `"monkeypatching"`, `"reporting"` |
| `findings_so_far`      | `number`                | Vulnerabilities found so far                           |
| `last_action`          | `string`                | Human-readable description of most recent action       |
| `health_status`        | `"healthy" \| "warning" \| "looping"` | Computed health status              |

### `LoopAlert`

| Field            | Type                    | Description                                     |
|------------------|-------------------------|-------------------------------------------------|
| `worker_id`      | `string`                | The flagged worker                               |
| `worker_type`    | `"pentester" \| "constructor"` | Subagent type                             |
| `dispatch_run_id`| `string`                | Parent scan run ID                               |
| `triggered_at`   | `string` (ISO 8601)     | When the alert was raised                        |
| `reasons`        | `string[]`              | Which heuristics fired (see below)               |
| `confidence`     | `"low" \| "medium" \| "high"` | Number of heuristics fired: 1=low, 2=medium, 3+=high |
| `diagnostics`    | `AgentDiagnostics`      | Snapshot at alert time                           |
| `auto_killed`    | `boolean`               | Whether the orchestrator terminated this worker  |

### Loop Detection Reasons

| Reason                    | Trigger condition                                    |
|---------------------------|------------------------------------------------------|
| `trace_length_exceeded`   | `trace_length > 200`                                 |
| `high_repetition_ratio`   | `repeated_calls / total_tool_calls > 0.4` (40%)      |
| `stale_no_new_actions`    | `updated_at` older than 120s                         |
| `error_spiral`            | `consecutive_errors >= 5`                            |
| `wall_clock_exceeded`     | `wall_clock_seconds > 600`                           |

---

## Accessing Diagnostics from the Frontend

### Option A: Poll the API directly

```typescript
import { useEffect, useState } from "react";

type WorkerType = "pentester" | "constructor";

function useDiagnostics(type?: WorkerType, pollMs = 5000) {
  const [workers, setWorkers] = useState<AgentDiagnostics[]>([]);
  const [alerts, setAlerts] = useState<LoopAlert[]>([]);

  useEffect(() => {
    const typeParam = type ? `?type=${type}` : "";
    const poll = async () => {
      const [diagRes, alertRes] = await Promise.all([
        fetch(`/api/diagnostics${typeParam}`),
        fetch(`/api/diagnostics/alerts${typeParam}`),
      ]);
      setWorkers((await diagRes.json()).workers);
      setAlerts((await alertRes.json()).alerts);
    };
    poll();
    const id = setInterval(poll, pollMs);
    return () => clearInterval(id);
  }, [type, pollMs]);

  return { workers, alerts };
}
```

### Option B: Read from `dispatch-output.json` (embedded)

Diagnostics are also embedded in worker graph nodes via `meta.diagnostics`. If you already consume the dispatch output (e.g. via `useDispatchWorkspace()`), you can extract diagnostics without an extra API call:

```typescript
import { useDispatchWorkspace } from "@/lib/dispatch/state";

function WorkerDiagnosticsPanel({ workerId }: { workerId: string }) {
  const { graphData } = useDispatchWorkspace();

  const workerNode = graphData.nodes.find(n => n.id === workerId);
  const diagnostics = workerNode?.meta?.diagnostics as AgentDiagnostics | undefined;

  if (!diagnostics) return <p>No diagnostics available</p>;

  return (
    <div>
      <HealthBadge status={diagnostics.health_status} />
      <p>Trace length: {diagnostics.trace_length}</p>
      <p>Tool calls: {diagnostics.total_tool_calls}</p>
      <p>Errors: {diagnostics.error_count}</p>
    </div>
  );
}
```

---

## Sorting & Filtering by Subagent Type

All list endpoints accept `?type=pentester|constructor` to filter by subagent type.

**Frontend sorting examples:**

```typescript
// Sort by most tool calls
workers.sort((a, b) => b.total_tool_calls - a.total_tool_calls);

// Sort by error rate (highest first)
workers.sort((a, b) => {
  const rateA = a.total_tool_calls ? a.error_count / a.total_tool_calls : 0;
  const rateB = b.total_tool_calls ? b.error_count / b.total_tool_calls : 0;
  return rateB - rateA;
});

// Sort by wall clock time (longest running first)
workers.sort((a, b) => b.wall_clock_seconds - a.wall_clock_seconds);

// Group by subagent type
const grouped = Object.groupBy(workers, w => w.worker_type);
// grouped.pentester: AgentDiagnostics[]
// grouped.constructor: AgentDiagnostics[]
```

---

## Health Status Indicators

Map `health_status` to visual indicators on worker nodes:

| Status    | Color  | Meaning                                       |
|-----------|--------|-----------------------------------------------|
| `healthy` | green  | Agent is making progress normally              |
| `warning` | amber  | One or more heuristics at >75% threshold       |
| `looping` | red    | Loop detector triggered, agent may be stuck    |

```typescript
const healthColors: Record<HealthStatus, string> = {
  healthy: "#22c55e",
  warning: "#f59e0b",
  looping: "#ef4444",
};
```

---

## Polling Recommendations

| Data source              | Recommended interval | Notes                              |
|--------------------------|---------------------|------------------------------------|
| `/api/diagnostics`       | 5s                  | Balances freshness vs load         |
| `/api/diagnostics/alerts`| 5s                  | Same cadence as diagnostics        |
| `dispatch-output.json`   | 2s (existing)       | Already polled; diagnostics embedded in graph nodes |
| `/api/diagnostics/:id`   | On-demand           | Use when inspector panel is open   |

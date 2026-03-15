# Agent Diagnostics API

The Agent Diagnostics system tracks per-agent metrics inside Blaxel sandboxes, polls them from the orchestrator host, detects infinite loops, and exposes data via API endpoints.

## API Endpoints

### GET /api/diagnostics

Returns all active worker diagnostics.

**Response:**
```json
{
  "workers": [
    {
      "worker_id": "pentester-sqli-001",
      "worker_type": "pentester",
      "dispatch_run_id": "run-abc123",
      "started_at": "2026-03-14T10:00:00.000Z",
      "updated_at": "2026-03-14T10:05:30.000Z",
      "wall_clock_seconds": 330,
      "trace_length": 45,
      "tool_calls": { "runAttackPhase": 1, "setupApp": 1 },
      "total_tool_calls": 12,
      "lines_added": 0,
      "lines_removed": 0,
      "unique_files_touched": ["src/routes/users.ts"],
      "repeated_calls": 2,
      "error_count": 0,
      "consecutive_errors": 0,
      "phase": "attack",
      "findings_so_far": 3,
      "last_action": "Found 3 potential vulnerabilities"
    }
  ],
  "count": 1
}
```

### GET /api/diagnostics/:worker_id

Returns diagnostics for a specific worker.

**Response:** Single `AgentDiagnostics` object (same shape as items in the array above).

**404** if worker not found.

### GET /api/diagnostics/alerts

Returns loop detection alerts.

**Response:**
```json
{
  "alerts": [
    {
      "worker_id": "pentester-sqli-001",
      "worker_type": "pentester",
      "dispatch_run_id": "run-abc123",
      "triggered_at": "2026-03-14T10:08:00.000Z",
      "reasons": [
        "Trace length 210 exceeds max 200",
        "Wall clock 650s exceeds max 600s"
      ],
      "diagnostics": { "..." },
      "auto_killed": false
    }
  ],
  "count": 1
}
```

## Health Status

Each worker is assigned a health status based on heuristic evaluation:

| Status | Meaning |
|--------|---------|
| `healthy` | All metrics within normal thresholds |
| `warning` | Approaching one or more thresholds (>70% of max) |
| `looping` | One or more thresholds exceeded |

### Detection Thresholds (defaults)

| Metric | Max | Warning at |
|--------|-----|-----------|
| Trace length | 200 | 140 |
| Wall clock | 600s | 420s |
| Consecutive errors | 5 | 3 |
| Repetition ratio | 40% | n/a |
| Staleness window | 120s | n/a |

## Architecture

```
Worker (sandbox)         Orchestrator (host)          Frontend
+------------------+    +---------------------+     +-----------+
| Accumulator      |    | Poller              |     | State     |
|  - tracks metrics|    |  - reads JSON files |     |  - polls  |
|  - flushes JSON  |--->|  - parses safely    |---->|  dispatch |
|  - atomic writes |    | Aggregator          |     |  output   |
+------------------+    |  - in-memory store  |     |           |
                        | LoopDetector        |     | Inspector |
                        |  - heuristic eval   |     |  - health |
                        |  - alerts           |     |  - metrics|
                        +---------------------+     +-----------+
                              |
                              v
                        Datadog Forwarder
                         - gauge metrics
                         - loop alert events
```

## Datadog Metrics

All metrics are prefixed with `dispatch.worker.*` and tagged with `worker_id`, `worker_type`, `dispatch_run_id`, `phase`, and `env`.

| Metric | Type | Description |
|--------|------|-------------|
| `dispatch.worker.wall_clock_seconds` | gauge | Time elapsed since worker start |
| `dispatch.worker.trace_length` | gauge | Number of conversation turns |
| `dispatch.worker.total_tool_calls` | gauge | Total tool invocations |
| `dispatch.worker.repeated_calls` | gauge | Same tool+args invocations |
| `dispatch.worker.error_count` | gauge | Total errors |
| `dispatch.worker.consecutive_errors` | gauge | Current error streak |
| `dispatch.worker.lines_added` | gauge | Lines of code added |
| `dispatch.worker.lines_removed` | gauge | Lines of code removed |
| `dispatch.worker.findings_so_far` | gauge | Findings discovered |
| `dispatch.worker.files_touched` | gauge | Unique files modified |

Loop alerts are sent as Datadog events with `alert_type: warning`.

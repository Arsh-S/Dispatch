# Agent Diagnostics Collector — Implementation Plan

**Goal**: Build a diagnostics collection system that tracks per-agent metrics inside Blaxel sandboxes, polls them from the orchestrator host, detects infinite loops, exposes data via API endpoints, surfaces health on the frontend graph, and forwards metrics to Datadog.

**Date**: 2026-03-14

---

## Context & Assumptions

- Workers run as Claude Code instances inside Blaxel sandboxes (or locally). They exchange data via JSON files under `/dispatch/`.
- The orchestrator (`agent.ts`) coordinates phases: pre-recon, attack-matrix, dispatch, collect. `DispatchOutputWriter` writes `dispatch-output.json` which the dashboard polls every 2s.
- Sandboxes expose `sandbox.fs.read()` and `sandbox.fs.write()` for file I/O, and `sandbox.process.exec()` for commands. Sandbox lifetime is TTL-bounded (30m).
- `dispatcher.ts` already has a `runBlaxelWorker` function that creates a sandbox, uploads code, runs the worker, reads back `finding-report.json`, then deletes the sandbox. The sandbox reference is scoped to that function — polling diagnostics requires keeping sandbox references alive longer (key architectural change).
- The existing `dispatch-log-middleware.ts` + `log-forwarder.ts` pattern (in-memory store + Datadog batched forwarding) is the template for the diagnostics system.
- Zod is used for all schemas (`/backend/src/schemas/`).
- Graph nodes already have a `meta` field (`Record<string, unknown>`) and `status` field (`NodeStatus`) — diagnostics can piggyback on these.
- The frontend `WorkerNode` maps `NodeStatus` to fill colors. Adding a "looping" health concept requires either a new status or using `meta` + `warning` status.

---

## Risks & Unknowns

1. **Sandbox lifecycle**: Currently sandboxes are created and destroyed within `runBlaxelWorker`. To poll diagnostics during execution, we need to either (a) keep the `SandboxInstance` reference accessible to a poller, or (b) have the worker push diagnostics to an external endpoint. Option (a) is simpler and recommended.
2. **Worker-side instrumentation**: Claude Code agents don't have a hook system — we need the `DiagnosticsAccumulator` to be initialized in the worker entry point and updated by wrapping tool calls. The pentester worker CLI (`cli.ts`) and agent code need modification.
3. **Local mode**: In local mode, workers run in-process. Diagnostics file would be written to the local `.dispatch/<worker_id>/` directory instead of `/dispatch/` in a sandbox.
4. **Polling overhead**: Reading a JSON file from each sandbox every 10s via `sandbox.fs.read()` is a network call to the Blaxel API. With many concurrent workers, this could be slow. Mitigation: poll in parallel, keep payloads small.
5. **Race conditions**: Worker writes diagnostics while poller reads. JSON writes are not atomic. Mitigation: worker writes to a temp file and renames, or poller handles parse errors gracefully.
6. **Frontend type sync**: Backend graph-types and frontend graphTypes are maintained separately (not generated). Changes to backend types must be manually mirrored.

---

## Plan

### Phase 1: Schema & Types

**Step 1.1** — Create Zod schema for agent diagnostics
- **File**: `/backend/src/schemas/agent-diagnostics.ts` (new)
- Define `AgentDiagnosticsSchema` with Zod:
  ```
  worker_id: string
  worker_type: 'pentester' | 'constructor'
  dispatch_run_id: string
  started_at: string (ISO)
  updated_at: string (ISO)
  wall_clock_seconds: number
  trace_length: number (conversation turns)
  tool_calls: Record<string, number> (tool name -> count)
  total_tool_calls: number
  lines_added: number
  lines_removed: number
  unique_files_touched: string[]
  repeated_calls: number (same tool+args invocations)
  error_count: number
  consecutive_errors: number
  phase: string (current phase/progress indicator)
  findings_so_far: number
  last_action: string (description of most recent action)
  ```
- Export `AgentDiagnostics` type via `z.infer`
- **Dependencies**: None

**Step 1.2** — Create loop detection types and config
- **File**: `/backend/src/schemas/agent-diagnostics.ts` (same file, appended)
- Define `LoopDetectionConfigSchema`:
  ```
  max_trace_length: number (default 200)
  max_repetition_ratio: number (default 0.4, i.e. 40% repeated calls)
  max_consecutive_errors: number (default 5)
  staleness_window_seconds: number (default 120, no new unique actions)
  max_wall_clock_seconds: number (default 600)
  ```
- Define `LoopAlertSchema`:
  ```
  worker_id: string
  worker_type: 'pentester' | 'constructor'
  dispatch_run_id: string
  triggered_at: string
  reasons: string[] (which heuristics fired)
  diagnostics: AgentDiagnostics (snapshot at alert time)
  auto_killed: boolean
  ```
- Export types
- **Dependencies**: Step 1.1

**Step 1.3** — Add diagnostics types to frontend
- **File**: `/frontend/lib/dispatch/graphTypes.ts` (modify)
- Add `AgentDiagnostics` and `LoopAlert` interfaces mirroring the Zod schemas
- Add optional `diagnostics?: AgentDiagnostics` to the `GraphNode` interface `meta` convention (no schema change needed since `meta` is `Record<string, unknown>`)
- Add `HealthStatus` type: `'healthy' | 'warning' | 'looping'`
- **Dependencies**: Step 1.1

---

### Phase 2: Worker-Side Accumulator

**Step 2.1** — Create DiagnosticsAccumulator class
- **File**: `/backend/src/diagnostics/accumulator.ts` (new)
- Class `DiagnosticsAccumulator`:
  - Constructor takes `worker_id`, `worker_type`, `dispatch_run_id`, `output_path` (default `/dispatch/agent-diagnostics.json`)
  - Internal state tracking all metrics from Step 1.1
  - `recordToolCall(toolName: string, args: string): void` — increments tool_calls[toolName], total_tool_calls, checks for repetition (hash of tool+args), updates trace_length
  - `recordLineEdits(added: number, removed: number): void`
  - `recordFileTouch(filePath: string): void`
  - `recordError(): void` — increments error_count and consecutive_errors
  - `clearConsecutiveErrors(): void` — called on successful action
  - `recordFinding(): void` — increments findings_so_far
  - `setPhase(phase: string): void`
  - `setLastAction(action: string): void`
  - `flush(): void` — writes current snapshot to `output_path` as JSON. Uses write-to-temp-then-rename pattern for atomicity.
  - `getSnapshot(): AgentDiagnostics` — returns current state
  - Auto-flush: calls `flush()` after every N tool calls (e.g., every 5) and on a 10s interval timer
  - `stop(): void` — clears interval, does final flush
- **Dependencies**: Step 1.1

**Step 2.2** — Integrate accumulator into pentester worker
- **File**: `/backend/src/workers/pentester/agent.ts` (modify) or the CLI entry point
- Locate the pentester worker entry point. At start:
  - Read task-assignment.json to get worker_id, dispatch_run_id
  - Instantiate `DiagnosticsAccumulator` with worker_type='pentester'
- Wrap or hook into the existing tool-call flow to call `accumulator.recordToolCall()`, `recordError()`, etc.
- On completion, call `accumulator.stop()`
- **Decision point**: If the pentester uses Claude Code SDK, we may need to wrap the tool execution layer. If it uses `child_process.exec` to invoke claude, we may need the accumulator to run in the wrapper process and parse Claude's output. This needs investigation of `/backend/src/workers/pentester/agent.ts`.
- **Dependencies**: Step 2.1

**Step 2.3** — Integrate accumulator into constructor worker
- **File**: `/backend/src/workers/constructor/` (modify entry point)
- Same pattern as Step 2.2 but with worker_type='constructor'
- **Dependencies**: Step 2.1

---

### Phase 3: Orchestrator-Side Polling & Loop Detection

**Step 3.1** — Create DiagnosticsPoller
- **File**: `/backend/src/diagnostics/poller.ts` (new)
- Class `DiagnosticsPoller`:
  - Maintains a map of `worker_id -> { sandbox: SandboxInstance, localPath?: string }`
  - `registerWorker(workerId: string, sandbox: SandboxInstance | null, localPath?: string): void`
  - `unregisterWorker(workerId: string): void`
  - `start(intervalMs: number = 10_000): void` — starts polling interval
  - `stop(): void` — clears interval
  - `pollAll(): Promise<Map<string, AgentDiagnostics>>` — reads `/dispatch/agent-diagnostics.json` from each registered sandbox (or local path). Handles parse errors gracefully (returns last known good data).
  - Emits events or calls a callback `onDiagnosticsUpdate(workerId: string, diagnostics: AgentDiagnostics): void`
- **Dependencies**: Step 1.1

**Step 3.2** — Create DiagnosticsAggregator (in-memory store)
- **File**: `/backend/src/diagnostics/aggregator.ts` (new)
- Class `DiagnosticsAggregator`:
  - In-memory `Map<string, AgentDiagnostics>`
  - `update(workerId: string, diagnostics: AgentDiagnostics): void`
  - `get(workerId: string): AgentDiagnostics | undefined`
  - `getAll(): AgentDiagnostics[]`
  - `getByType(type: 'pentester' | 'constructor'): AgentDiagnostics[]`
  - `getAlerts(): LoopAlert[]` — returns current loop alerts
  - `remove(workerId: string): void`
  - `clear(): void`
- Pattern mirrors `logStore` in `dispatch-log-middleware.ts`
- **Dependencies**: Step 1.1, Step 1.2

**Step 3.3** — Create LoopDetector
- **File**: `/backend/src/diagnostics/loop-detector.ts` (new)
- Class `LoopDetector`:
  - Constructor takes `LoopDetectionConfig` (with defaults)
  - `evaluate(diagnostics: AgentDiagnostics): LoopAlert | null`
  - Heuristics:
    1. `trace_length > config.max_trace_length` — "Trace length exceeded"
    2. `repeated_calls / total_tool_calls > config.max_repetition_ratio` — "High repetition ratio"
    3. `updated_at` older than `config.staleness_window_seconds` from now — "Stale: no new actions"
    4. `consecutive_errors >= config.max_consecutive_errors` — "Error spiral"
    5. `wall_clock_seconds > config.max_wall_clock_seconds` — "Wall clock exceeded"
  - Returns alert with all triggered reason strings, or null if healthy
  - `getHealthStatus(diagnostics: AgentDiagnostics): 'healthy' | 'warning' | 'looping'`:
    - looping: any heuristic fully triggered
    - warning: any heuristic at >75% threshold
    - healthy: otherwise
- **Dependencies**: Step 1.2

**Step 3.4** — Wire poller + aggregator + loop detector into dispatcher
- **File**: `/backend/src/orchestrator/dispatcher.ts` (modify)
- In `dispatchBlaxel`:
  - Before dispatching, create shared `DiagnosticsPoller`, `DiagnosticsAggregator`, `LoopDetector` instances
  - Modify `runBlaxelWorker` to accept and register with the poller before starting the worker process
  - Modify `runBlaxelWorker` to NOT delete the sandbox immediately in finally — instead, unregister from poller first, then delete
  - After all workers dispatched, start poller
  - Poller callback: aggregator.update() -> loopDetector.evaluate() -> if looping, auto-kill via sandbox.delete()
  - On batch complete, stop poller
- In `dispatchLocal`:
  - Similar but using local file paths instead of sandbox references
- Export aggregator reference for API consumption
- **Dependencies**: Steps 3.1, 3.2, 3.3

**Step 3.5** — Expose diagnostics on DispatchOutputWriter
- **File**: `/backend/src/orchestrator/dispatch-output-writer.ts` (modify)
- Add method `onDiagnosticsUpdate(workerId: string, diagnostics: AgentDiagnostics): void`
  - Stores diagnostics in worker node's `meta.diagnostics`
  - Maps health status to node status (warning/failed for looping)
  - Calls `rebuildGraphData()` and `write()` — but throttled (max once per 5s to avoid excessive disk I/O)
- **File**: `/backend/src/orchestrator/graph-types.ts` (modify)
  - Add optional `diagnostics?: Record<string, AgentDiagnostics>` to `DispatchOutput`
- **File**: `/backend/src/orchestrator/graph-builder.ts` (modify)
  - Accept optional diagnostics map parameter
  - When building worker nodes, if diagnostics exist for a worker_id, include them in `meta.diagnostics` and set `activityLevel` based on recent tool call rate
  - Map health status to node status override: if loop detector says "looping", set node status to `warning`
- **Dependencies**: Steps 3.2, 3.4

---

### Phase 4: API Endpoints

**Step 4.1** — Create diagnostics API routes
- **File**: `/backend/src/api/server.ts` (modify)
- Add three endpoints:
  1. `GET /api/diagnostics` — returns all active worker diagnostics from aggregator
     - Query params: `?type=pentester|constructor` for filtering
     - Response: `{ workers: AgentDiagnostics[], count: number }`
  2. `GET /api/diagnostics/:worker_id` — returns single worker diagnostics
     - Response: `AgentDiagnostics` or 404
  3. `GET /api/diagnostics/alerts` — returns all current loop alerts
     - Query params: `?type=pentester|constructor`
     - Response: `{ alerts: LoopAlert[], count: number }`
- Import aggregator singleton from dispatcher module
- **Dependencies**: Steps 3.2, 3.4

---

### Phase 5: Datadog Integration

**Step 5.1** — Create diagnostics metrics forwarder
- **File**: `/backend/src/integrations/datadog/diagnostics-forwarder.ts` (new)
- Function `forwardDiagnosticsMetrics(diagnostics: AgentDiagnostics): void`
  - Sends gauge metrics to Datadog via `sendMetrics()`:
    - `dispatch.agent.trace_length`
    - `dispatch.agent.tool_calls`
    - `dispatch.agent.error_rate`
    - `dispatch.agent.consecutive_errors`
    - `dispatch.agent.wall_clock_seconds`
    - `dispatch.agent.findings`
    - `dispatch.agent.repeated_calls`
  - Tags: `worker_id`, `worker_type`, `dispatch_run_id`
- Function `forwardLoopAlert(alert: LoopAlert): void`
  - Sends Datadog event via `sendEvent()` with alert_type='warning'
  - Tags include reasons
- Pattern follows existing `collector.ts` -> `forwardToDatadog()` and `log-forwarder.ts`
- **Dependencies**: Steps 1.1, 1.2, existing Datadog client

**Step 5.2** — Wire forwarder into poller callback
- **File**: `/backend/src/diagnostics/poller.ts` or `/backend/src/orchestrator/dispatcher.ts` (modify)
- On each diagnostics update, call `forwardDiagnosticsMetrics()`
- On loop alert, call `forwardLoopAlert()`
- Throttle to avoid flooding Datadog (e.g., forward metrics every 30s per worker, not every 10s poll)
- **Dependencies**: Step 5.1, Step 3.4

---

### Phase 6: Frontend Integration

**Step 6.1** — Add diagnostics to frontend state
- **File**: `/frontend/lib/dispatch/state.tsx` (modify)
- Add `diagnostics: Record<string, AgentDiagnostics>` to `DispatchWorkspaceState`
- In `loadDispatchOutput`, extract `data.diagnostics` if present
- Add `getDiagnosticsByWorkerId(workerId: string)` helper to context value
- **Dependencies**: Step 1.3, Step 3.5

**Step 6.2** — Update WorkerNode to show health status
- **File**: `/frontend/components/dispatch/graph/WorkerNode.tsx` (modify)
- Accept optional `healthStatus?: HealthStatus` prop
- Add visual indicators:
  - `healthy`: no change (existing green/blue)
  - `warning`: amber/yellow pulsing ring
  - `looping`: red pulsing ring with exclamation indicator
- Derive `healthStatus` from `meta.diagnostics` in the parent component (`GraphWorkspace` or `GraphCanvas`)
- **Dependencies**: Step 1.3, Step 6.1

**Step 6.3** — Add diagnostics panel to WorkerInspector
- **File**: `/frontend/components/dispatch/inspector/WorkerInspector.tsx` (modify)
- Add a new "Diagnostics" card section (after the existing Report card):
  - Health status badge (green/yellow/red)
  - Trace length with progress bar (relative to max threshold)
  - Tool call breakdown (bar chart or list)
  - Error rate / consecutive errors
  - Wall clock duration
  - Repetition ratio
  - Findings so far
  - Last action timestamp + description
  - If looping: alert banner with reasons
- Only show section when diagnostics data is available
- **Dependencies**: Step 1.3, Step 6.1

**Step 6.4** — Add diagnostics to GraphCanvas/GraphWorkspace
- **File**: `/frontend/components/dispatch/graph/GraphWorkspace.tsx` or `GraphCanvas.tsx` (modify)
- When rendering worker nodes, pass `healthStatus` derived from `diagnostics` in `meta`
- **Dependencies**: Step 6.2

---

### Phase 7: Documentation

**Step 7.1** — Create API documentation
- **File**: `/docs/agent-diagnostics-api.md` (new)
- Document:
  - All three API endpoints with request/response examples
  - Query parameter for filtering by subagent type (`?type=pentester|constructor`)
  - `AgentDiagnostics` schema with field descriptions
  - `LoopAlert` schema
  - Health status derivation logic
  - Example: how to get all pentester diagnostics sorted by trace length
  - Example: how to poll for looping agents
  - WebSocket/polling recommendations for frontend consumption
- **Dependencies**: Steps 4.1, 1.1, 1.2

---

## Dependency Graph

```
Phase 1 (Schema)
  1.1 ──┬── 1.2
        │
Phase 2 (Worker)
  2.1 ──┬── 2.2
        └── 2.3
        │
Phase 3 (Orchestrator)
  3.1 ──┤
  3.2 ──┼── 3.4 ── 3.5
  3.3 ──┘
        │
Phase 4 (API)         Phase 5 (Datadog)      Phase 6 (Frontend)
  4.1                   5.1 ── 5.2             6.1 ── 6.2
                                                      6.3
                                                      6.4
Phase 7 (Docs)
  7.1 (after 4.1)
```

Phases 4, 5, and 6 can proceed in parallel after Phase 3 is complete.
Phase 2 can proceed in parallel with Phase 3 (worker-side is independent of orchestrator-side until wiring in 3.4).

---

## File Summary

### New files (7)
| File | Purpose |
|------|---------|
| `/backend/src/schemas/agent-diagnostics.ts` | Zod schemas for diagnostics, loop config, alerts |
| `/backend/src/diagnostics/accumulator.ts` | Worker-side metrics accumulator class |
| `/backend/src/diagnostics/poller.ts` | Orchestrator-side sandbox diagnostics poller |
| `/backend/src/diagnostics/aggregator.ts` | In-memory diagnostics store |
| `/backend/src/diagnostics/loop-detector.ts` | Heuristic-based loop detection |
| `/backend/src/integrations/datadog/diagnostics-forwarder.ts` | Datadog metrics/events for diagnostics |
| `/docs/agent-diagnostics-api.md` | API documentation for frontend developers |

### Modified files (9)
| File | Change |
|------|--------|
| `/backend/src/orchestrator/dispatcher.ts` | Wire poller, aggregator, loop detector; keep sandbox refs |
| `/backend/src/orchestrator/constructor-dispatcher.ts` | Wire poller for constructor sandboxes |
| `/backend/src/orchestrator/dispatch-output-writer.ts` | Add diagnostics update method, throttled writes |
| `/backend/src/orchestrator/graph-types.ts` | Add diagnostics field to DispatchOutput |
| `/backend/src/orchestrator/graph-builder.ts` | Include diagnostics in worker node meta |
| `/backend/src/api/server.ts` | Add 3 diagnostics API endpoints |
| `/frontend/lib/dispatch/graphTypes.ts` | Add AgentDiagnostics, LoopAlert, HealthStatus types |
| `/frontend/lib/dispatch/state.tsx` | Add diagnostics state and accessor |
| `/frontend/components/dispatch/graph/WorkerNode.tsx` | Health status visual indicators |
| `/frontend/components/dispatch/inspector/WorkerInspector.tsx` | Diagnostics detail panel |
| `/frontend/components/dispatch/graph/GraphWorkspace.tsx` | Pass health status to worker nodes |
| Worker entry points (pentester/constructor) | Initialize and use DiagnosticsAccumulator |

---

## Open Questions

1. **Worker instrumentation depth**: How does the pentester agent invoke Claude Code? If via subprocess (`claude` CLI), we may need to parse stdout for tool call events rather than wrapping function calls. Need to inspect `/backend/src/workers/pentester/agent.ts` in detail.

2. **Auto-kill behavior**: Should auto-kill be opt-in (configurable flag) or always-on? Recommendation: on by default with a `DISPATCH_AUTO_KILL_LOOPING=true|false` env var.

3. **Diagnostics persistence**: Should diagnostics survive across orchestrator restarts? Current plan is in-memory only (like logs). If persistence is needed, consider writing to `dispatch-output.json`.

4. **Polling vs push**: The current plan uses polling (orchestrator reads from sandbox). An alternative is having workers POST diagnostics to the API server. Polling is simpler for Blaxel sandboxes (no outbound connectivity config needed), but push would be more real-time.

5. **Frontend polling frequency**: The dashboard polls `dispatch-output.json` every 2s. Diagnostics embedded in that file would update at 2s granularity. The separate `/api/diagnostics` endpoint could be polled independently at a different rate if needed. Which approach should be primary?

6. **Node status mapping**: Should "looping" be a new `NodeStatus` enum value, or should it reuse `warning`? Adding a new enum value requires changes in both backend and frontend. Using `warning` is simpler but less precise. Recommendation: use `warning` status + `meta.healthStatus` field for precision.

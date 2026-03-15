# Plan: Stdout/Stderr Test Runner — Versatile Result Capture

**Date:** 2026-03-14  
**Scope:** Add a test-suite runner that captures stdout + stderr from arbitrary test commands (pytest, npm test, etc.) with zero configuration in the target app. Designed for minimal setup — uv or npm venv only, no Datadog.

---

## 0. Guiding Principles

1. **Stdout/stderr is the primary interface.** No file-based reports, no JUnit XML, no plugins. Run whatever command the target app already uses.
2. **Zero config in target.** Auto-detect test command from `pyproject.toml`, `package.json`, or env. Fallback to sensible defaults.
3. **Works without Datadog.** No observability dependencies. Results flow through in-memory capture → orchestrator → frontend.
4. **Additive.** New flow alongside existing pentester workers. Does not replace or modify the security scan pipeline.

---

## 1. Current vs Target

### Current

- **Pentester worker:** Writes `finding-report.json` to sandbox filesystem; orchestrator reads via `sandbox.fs.read()`.
- **WorkerResult:** `{ workerId, report: FindingReport | null, error? }` — report is always `FindingReport`.
- **Result acquisition:** File-based only.

### Target

- **Test suite runner:** Runs `uv run pytest`, `npm test`, etc.; captures stdout + stderr from `process.exec`; produces `TestRunReport`.
- **WorkerResult:** Union type — `report: FindingReport | TestRunReport | null` (discriminated by `report_type` or presence of `findings`).
- **Result acquisition:** Stdout/stderr capture as primary; optional file fallback for structured output if present.

---

## 2. Architecture

```
runTestSuite(targetDir, options?)
  │
  ├─ [local]  runLocalTestRunner()
  │               execSync/spawn test command → capture stdout/stderr
  │
  └─ [blaxel] runBlaxelTestRunner()
                  upload app → install deps → process.exec(test_command)
                  → result.logs (stdout + stderr) → buildTestRunReport()

  └─ TestRunReport → dispatch-output / frontend
```

**Key difference from pentester:** No worker writes a file. The orchestrator (or test runner module) builds the report from `process.exec` result.

---

## 3. Schema Design

### 3.1 TestRunReport (new)

```typescript
// backend/src/schemas/test-run-report.ts
import { z } from 'zod';

export const TestRunReportSchema = z.object({
  dispatch_run_id: z.string(),
  worker_id: z.string(),
  completed_at: z.string(),
  status: z.enum(['passed', 'failed', 'timeout', 'error']),
  exit_code: z.number().nullable(),
  duration_seconds: z.number(),
  command: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  parsed_summary: z.object({
    passed: z.number().optional(),
    failed: z.number().optional(),
    skipped: z.number().optional(),
    total: z.number().optional(),
    framework: z.string().optional(), // 'pytest' | 'jest' | 'vitest' | 'unknown'
  }).optional(),
});

export type TestRunReport = z.infer<typeof TestRunReportSchema>;
```

### 3.2 WorkerResult extension

```typescript
// backend/src/orchestrator/dispatcher.ts
export type WorkerReport = FindingReport | TestRunReport;

export interface WorkerResult {
  workerId: string;
  report: WorkerReport | null;
  reportType: 'finding' | 'test_run';  // discriminator
  error?: string;
}
```

**Alternative (simpler):** Keep `WorkerResult.report` as `FindingReport | null` for the existing pipeline. Add a **separate** `TestRunResult` and `runTestSuite()` flow that does not go through `dispatchWorkers()`. The frontend would have a separate view for "Test Suite" runs vs "Security Scan" runs.

**Recommendation:** Use the separate flow for v1. Keeps the pentester pipeline untouched. We can unify later if needed.

---

## 4. Implementation Plan

### Phase 1 — Schema & Test Runner Module

#### Task 1.1: Create TestRunReport schema

| File | Action |
|------|--------|
| `backend/src/schemas/test-run-report.ts` | **Create** — `TestRunReportSchema`, `TestRunReport` type |

#### Task 1.2: Create test command detector

| File | Action |
|------|--------|
| `backend/src/test-runner/detect-command.ts` | **Create** — `detectTestCommand(targetDir: string): string` |

Logic:
- If `pyproject.toml` exists → `uv run pytest` (or `python -m pytest` if no uv)
- If `package.json` has `scripts.test` → `npm test` or `pnpm test` (detect from lockfile)
- Fallback: `npm test` (Node) or `pytest` (Python) based on presence of `package.json` vs `pyproject.toml`

#### Task 1.3: Create test runner (local mode)

| File | Action |
|------|--------|
| `backend/src/test-runner/runner.ts` | **Create** — `runLocalTestRunner(targetDir, options): Promise<TestRunReport>` |

- Spawn process with `command` from detector (or override via options)
- Capture stdout, stderr via `child_process.spawn` or `execSync` with encoding
- Record start/end time, exit code
- Build `TestRunReport` with raw stdout/stderr
- Optional: call `parseTestOutput(stdout, stderr)` for `parsed_summary`

#### Task 1.4: Create output parsers (optional)

| File | Action |
|------|--------|
| `backend/src/test-runner/parsers.ts` | **Create** — `parseTestOutput(stdout: string, stderr: string): ParsedSummary | null` |

Regex patterns for:
- **pytest:** `(\d+) passed`, `(\d+) failed`, `(\d+) skipped`
- **jest/vitest:** `Tests:\s*(\d+) passed`, `(\d+) total`
- **go test:** `ok` / `FAIL`
- Return `null` if no match — raw output still shown

---

### Phase 2 — Blaxel Integration

#### Task 2.1: Create Blaxel test runner

| File | Action |
|------|--------|
| `backend/src/test-runner/blaxel-runner.ts` | **Create** — `runBlaxelTestRunner(targetDir, options): Promise<TestRunReport>` |

Flow:
1. Create sandbox (no port needed for test-only)
2. Upload target app via existing `uploadDirectory` (extract to shared util if not already)
3. `process.exec(install_command)` — use `app_config.install` or detect
4. `process.exec(test_command)` with `waitForCompletion: true`
5. Extract stdout/stderr from `result.logs` — handle both shapes:
   - `result.logs` as string (combined)
   - `result.logs?.stdout` and `result.logs?.stderr` (if object)
6. Build `TestRunReport`
7. Delete sandbox

#### Task 2.2: Handle Blaxel process.exec result shape

Blaxel SDK may return:
- `{ logs: string }` — combined output
- `{ logs: { stdout: string, stderr: string } }` — per research doc

Add helper:
```typescript
function extractLogs(result: ProcessResult): { stdout: string; stderr: string } {
  const logs = result.logs;
  if (typeof logs === 'string') {
    return { stdout: logs, stderr: '' };
  }
  return {
    stdout: logs?.stdout ?? '',
    stderr: logs?.stderr ?? '',
  };
}
```

---

### Phase 3 — CLI & Orchestrator Integration

#### Task 3.1: Add CLI command

| File | Action |
|------|--------|
| `backend/src/cli.ts` | **Modify** — add `pnpm test:suite` or `pnpm run test-suite` |

```bash
pnpm test:suite [--mode local|blaxel] [--target ./path]
```

- Default mode: `local`
- Writes output to `frontend/public/test-run-output.json` (or extend `dispatch-output.json` with test_run_reports)

#### Task 3.2: Extend dispatch output (optional)

If we want test runs to appear in the same graph/dashboard:

| File | Action |
|------|--------|
| `backend/src/orchestrator/graph-types.ts` | **Modify** — add `test_run_reports?: TestRunReport[]` to `DispatchOutput` |
| `backend/src/orchestrator/dispatch-output-writer.ts` | **Modify** — accept test run results, merge into output |

**Simpler v1:** Separate output file `test-run-output.json` with structure:
```json
{
  "run_id": "...",
  "status": "passed" | "failed",
  "report": { ...TestRunReport },
  "started_at": "...",
  "completed_at": "..."
}
```

---

### Phase 4 — Frontend

#### Task 4.1: Test run output viewer

| File | Action |
|------|--------|
| `frontend/app/test-suite/page.tsx` or extend `/dispatch` | **Create/Modify** — view for test run results |

- Poll `test-run-output.json` (or fetch once)
- Show: status badge, duration, exit code
- **Raw output:** Scrollable `<pre>` with stdout (and stderr in expandable section)
- Optional: parsed summary (X passed, Y failed) if available

#### Task 4.2: WorkerInspector extension (if unified)

If test runs are merged into the main dispatch flow with WorkerResult union:

| File | Action |
|------|--------|
| `frontend/components/dispatch/inspector/WorkerInspector.tsx` | **Modify** — detect `TestRunReport` vs `FindingReport`, render accordingly |

For TestRunReport: show status, duration, command, raw stdout/stderr in `<pre>`.

---

## 5. App Config Extension

For explicit override (optional):

```typescript
// In task-assignment or a new TestRunConfig
app_config: {
  // ... existing
  test_command?: string;  // e.g. "uv run pytest -v"
}
```

If `test_command` is set, use it. Otherwise use detector.

---

## 6. File Summary

| File | Action |
|------|--------|
| `backend/src/schemas/test-run-report.ts` | Create |
| `backend/src/test-runner/detect-command.ts` | Create |
| `backend/src/test-runner/parsers.ts` | Create |
| `backend/src/test-runner/runner.ts` | Create |
| `backend/src/test-runner/blaxel-runner.ts` | Create |
| `backend/src/test-runner/index.ts` | Create — export `runTestSuite(targetDir, { mode })` |
| `backend/src/cli.ts` | Modify — add test:suite command |
| `frontend/app/test-suite/page.tsx` | Create (or add tab to dispatch page) |
| `backend/.env.example` | Document — no new vars (no Datadog) |

---

## 7. Testing

| Test | Scope |
|------|--------|
| `detect-command.test.ts` | Detects pytest for pyproject.toml, npm test for package.json |
| `parsers.test.ts` | Extracts passed/failed from pytest, jest output |
| `runner.test.ts` | Local runner captures stdout/stderr, builds valid TestRunReport |
| `blaxel-runner.test.ts` | Mock sandbox, assert exec called with correct command, report built from logs |

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Blaxel 60s timeout for `waitForCompletion: true` | Use `waitForCompletion: false` + `process.wait()` for long test suites (see research doc) |
| Large stdout truncation | Cap stored stdout/stderr at 100KB, add "truncated" flag; frontend shows "Show full output" link if needed |
| Detector picks wrong command | Allow explicit `--command "uv run pytest"` override in CLI |
| Python/Node not in PATH in sandbox | Blaxel base image; document that target must have standard tooling |

---

## 9. Out of Scope (v1)

- Merging test runs into the security scan graph (separate flow is fine)
- Datadog forwarding of test output
- JUnit/JSON file parsing (stdout-only for versatility)
- Retry logic, parallel test workers

---

## 10. Success Criteria

- [ ] `pnpm test:suite` runs pytest in a Python project (local) and captures output
- [ ] `pnpm test:suite` runs `npm test` in a Node project (local) and captures output
- [ ] `pnpm test:suite --mode blaxel` runs in sandbox, captures stdout/stderr
- [ ] Frontend shows raw test output in scrollable view
- [ ] Zero configuration in target app — works with just `pyproject.toml` or `package.json`
- [ ] No Datadog or other external services required

# Memory Layer — Extensive Implementation Plan

**Goal:** Cross-run memory so the orchestrator can say *"this endpoint has been flagged in 4 consecutive scans, bump it to Critical"* and PRs/Slack surface recurrence.

**Hackathon focus:** Tangible ROI — PR schema with scan history, Slack recurrence callouts, escalation.

---

## Table of Contents

1. [Overview & Dependencies](#1-overview--dependencies)
2. [Phase 1: Memory Store (Core)](#2-phase-1-memory-store-core)
3. [Phase 2: Orchestrator Integration](#3-phase-2-orchestrator-integration)
4. [Phase 3: Escalation Logic](#4-phase-3-escalation-logic)
5. [Phase 4: Slack Integration](#5-phase-4-slack-integration)
6. [Phase 5: PR Schema Enrichment](#6-phase-5-pr-schema-enrichment)
7. [Phase 6: Dashboard & Optional Features](#7-phase-6-dashboard--optional-features)
8. [Testing Strategy](#8-testing-strategy)
9. [Demo Script (Hackathon)](#9-demo-script-hackathon)
10. [Rollback & Feature Flags](#10-rollback--feature-flags)

---

## 1. Overview & Dependencies

### 1.1 New Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `better-sqlite3` | SQLite driver (sync, no native deps issues) | ^11.x |
| `@types/better-sqlite3` | Types | ^7.x |

```bash
cd backend && pnpm add better-sqlite3 && pnpm add -D @types/better-sqlite3
```

### 1.2 File Layout (New/Modified)

```
backend/src/
├── memory/
│   ├── index.ts              # Public API, MemoryStore interface
│   ├── types.ts              # MemoryContext, FindingHistoryEntry, etc.
│   ├── fingerprint.ts        # generateFindingFingerprint (shared with collector)
│   ├── sqlite-store.ts       # SQLite implementation
│   ├── config.ts             # Escalation rules, target ID resolution
│   └── __tests__/
│       ├── sqlite-store.test.ts
│       └── escalation.test.ts
├── orchestrator/
│   ├── agent.ts              # MODIFIED: recordRun, getConsecutiveCounts, applyEscalation
│   └── collector.ts          # MODIFIED: export generateFindingKey, add applyEscalation
├── escalation.ts             # NEW: applyEscalation logic (or in collector)
├── slack/
│   ├── client.ts             # MODIFIED: formatFindingsResponse accepts memoryContext
│   └── handlers.ts           # MODIFIED: pass memoryContext to formatFindingsResponse
└── workers/constructor/
    └── pr.ts                 # MODIFIED: formatPRBody accepts memoryContext, fetch from memory
```

### 1.3 Target ID Resolution

| Source | Priority | Example |
|--------|----------|---------|
| `DISPATCH_TARGET_ID` env | 1 | `flask-target` |
| `GITHUB_REPO` env | 2 | `owner/repo` |
| `path.basename(targetDir)` | 3 | `flask-target` |

**Config:** `backend/src/memory/config.ts`

```ts
export function resolveTargetId(targetDir: string): string {
  return process.env.DISPATCH_TARGET_ID
    ?? process.env.GITHUB_REPO
    ?? path.basename(targetDir);
}
```

### 1.4 Database Location

**Default:** `./.dispatch/memory.db` (relative to `targetDir` or `process.cwd()`)

**Override:** `DISPATCH_MEMORY_DB_PATH` env

**Rationale:** Co-located with target for local dev; can override for shared Slack instance.

---

## 2. Phase 1: Memory Store (Core)

**Estimated:** 1–2 days

### 2.1 Interface (`memory/types.ts`)

```ts
export interface MemoryStore {
  recordRun(targetId: string, runId: string, report: MergedReport): Promise<void>;
  getConsecutiveCounts(targetId: string, fingerprints: string[], lookback?: number): Promise<Map<string, number>>;
  getHistoryForFinding(targetId: string, fingerprint: string, limit?: number): Promise<FindingHistoryEntry[]>;
  close(): void;
}

export interface FindingHistoryEntry {
  run_id: string;
  completed_at: string;
  severity: string;
}
```

### 2.2 Fingerprint (`memory/fingerprint.ts`)

```ts
import crypto from 'crypto';

export function generateFindingFingerprint(finding: {
  location: { endpoint: string; parameter?: string | null };
  vuln_type: string;
}): string {
  const raw = `${finding.location.endpoint}:${finding.location.parameter || ''}:${finding.vuln_type}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}
```

**Note:** Collector must use this same function. Export from `memory/fingerprint` and import in `collector.ts` (or keep `collector.ts` version and have memory re-export for consistency).

### 2.3 SQLite Store (`memory/sqlite-store.ts`)

**Tasks:**

1. **Create DB** — `initSchema(db)` on first run
2. **Schema** — Tables: `targets`, `runs`, `finding_occurrences` (see design doc)
3. **recordRun** — Upsert target, insert run, insert finding_occurrences (bulk)
4. **getConsecutiveCounts** — For each fingerprint:
   - Get runs for target ordered by `completed_at DESC` limit `lookback`
   - For each run, check if fingerprint exists
   - Count consecutive from most recent until first gap
5. **getHistoryForFinding** — Select runs where fingerprint exists, ordered by `completed_at DESC`, limit `limit`

**Consecutive algorithm (pseudocode):**

```ts
function getConsecutiveCount(targetId: string, fingerprint: string, lookback: number): number {
  const runs = getRunsForTarget(targetId, lookback); // ordered newest first
  let count = 0;
  for (const run of runs) {
    if (hasFinding(run.id, fingerprint)) count++;
    else break; // gap — streak ends
  }
  return count;
}
```

### 2.4 Config (`memory/config.ts`)

```ts
export const ESCALATION_RULES = {
  consecutiveScansToCritical: parseInt(process.env.DISPATCH_ESCALATE_TO_CRITICAL ?? '4', 10),
  consecutiveScansToHigh: parseInt(process.env.DISPATCH_ESCALATE_TO_HIGH ?? '2', 10),
  lookbackRuns: parseInt(process.env.DISPATCH_MEMORY_LOOKBACK ?? '10', 10),
};
```

### 2.5 Lazy Initialization

Memory store should be **optional**. If DB path is invalid or DB fails to create, log warning and continue without memory (no-op). All memory calls are best-effort.

```ts
// memory/index.ts
let store: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore | null {
  if (store) return store;
  try {
    store = createSqliteStore();
    return store;
  } catch (e) {
    console.warn('[Memory] Cannot initialize store:', e);
    return null;
  }
}
```

### 2.6 Tests

- `recordRun` — insert, verify rows in DB
- `getConsecutiveCounts` — seed 5 runs, 3 consecutive with finding A → returns 3
- `getConsecutiveCounts` — seed 5 runs, A in 1,2,4,5 → returns 2 (streak from 5)
- `getHistoryForFinding` — returns correct run entries

---

## 3. Phase 2: Orchestrator Integration

**Estimated:** 0.5–1 day

### 3.1 Orchestrator Changes (`orchestrator/agent.ts`)

**Insert after `mergeReports` (before `writer.onComplete`):**

```ts
// Resolve target ID
const targetId = resolveTargetId(options.targetDir);

if (mergedReport && getMemoryStore()) {
  const store = getMemoryStore()!;
  await store.recordRun(targetId, dispatchRunId, mergedReport);

  const fingerprints = mergedReport.findings.map(f => generateFindingFingerprint(f));
  const consecutiveCounts = await store.getConsecutiveCounts(targetId, fingerprints);

  mergedReport = applyEscalation(mergedReport, consecutiveCounts);
}
```

**OrchestratorOptions** — add optional `targetId?: string` for override (e.g. from Slack config).

### 3.2 Data Flow

```
mergeReports() → mergedReport (raw)
       ↓
recordRun(targetId, runId, mergedReport)
       ↓
getConsecutiveCounts(targetId, fingerprints)
       ↓
applyEscalation(mergedReport, consecutiveCounts) → escalatedReport
       ↓
writer.onComplete(escalatedReport)
forwardToDatadog(escalatedReport)
return { ..., mergedReport: escalatedReport }
```

### 3.3 Return Value

`OrchestratorResult` should include `consecutiveCounts?: Map<string, number>` for Slack/PR consumers. Or we pass it through the report. Cleanest: add `finding_metadata?: Map<finding_id, { consecutiveCount, escalatedFrom }>` to `MergedReport` or extend `Finding` with optional fields.

**Simpler approach:** Add `consecutive_count?: number` and `escalated_from?: string` to each `Finding` when we have memory. The collector's `applyEscalation` mutates findings and adds these fields.

---

## 4. Phase 3: Escalation Logic

**Estimated:** 1 day

### 4.1 Escalation Module (`escalation.ts` or `collector.ts`)

```ts
export function applyEscalation(
  report: MergedReport,
  consecutiveCounts: Map<string, number>,
): MergedReport {
  const { consecutiveScansToCritical, consecutiveScansToHigh } = ESCALATION_RULES;

  const escalatedFindings = report.findings.map(f => {
    const fp = generateFindingFingerprint(f);
    const count = consecutiveCounts.get(fp) ?? 1;

    let severity = f.severity;
    let escalatedFrom: string | undefined;

    if (count >= consecutiveScansToCritical && (severity === 'HIGH' || severity === 'MEDIUM' || severity === 'LOW')) {
      escalatedFrom = severity;
      severity = 'CRITICAL';
    } else if (count >= consecutiveScansToHigh && (severity === 'MEDIUM' || severity === 'LOW')) {
      escalatedFrom = severity;
      severity = 'HIGH';
    }

    return {
      ...f,
      severity,
      ...(escalatedFrom && { escalated_from: escalatedFrom, consecutive_count: count }),
    };
  });

  // Rebuild summary
  const summary = { ...report.summary };
  summary.critical = escalatedFindings.filter(f => f.severity === 'CRITICAL').length;
  summary.high = escalatedFindings.filter(f => f.severity === 'HIGH').length;
  // etc.

  return { ...report, findings: escalatedFindings, summary };
}
```

### 4.2 Finding Schema Extension

Add optional fields to `Finding` (or a wrapper type for output):

```ts
// In finding-report schema or a separate type
interface FindingWithMemory extends Finding {
  consecutive_count?: number;
  escalated_from?: string;
}
```

### 4.3 Tests

- HIGH + 4 consecutive → CRITICAL
- MEDIUM + 2 consecutive → HIGH
- HIGH + 2 consecutive → no change (need 4 for Critical)
- No memory data → no changes

---

## 5. Phase 4: Slack Integration

**Estimated:** 1 day

### 5.1 Handler Changes (`slack/handlers.ts`)

`handleSecurityScan` returns `AgentProcessingResult` with `findings`. The findings come from `toSlackFinding(mergedReport.findings)`. We need to pass `consecutive_count` and `escalated_from` into the Slack finding format.

**toSlackFinding** — extend to include `consecutive_count?: number` and `escalated_from?: string`.

**formatFindingsResponse** — add optional `memoryContext?: Map<findingKey, { consecutiveCount, escalatedFrom }>` or pass findings that already have these fields.

**Simpler:** Pass `findings` that include `consecutive_count` and `escalated_from` (from merged report). The `toSlackFinding` maps these. Then `formatFindingsResponse` can render a recurrence line when `consecutive_count >= 2`.

### 5.2 formatFindingsResponse Changes (`slack/client.ts`)

```ts
// Current finding block
{
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: `*${index + 1}. ${finding.type}* (${finding.severity.toUpperCase()})\n${finding.description}...`
  },
}

// With recurrence (when finding.consecutive_count >= 2)
{
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: `*${index + 1}. ${finding.type}* (${finding.severity.toUpperCase()})${recurrenceLine}\n${finding.description}...`
  },
}

// recurrenceLine = finding.consecutive_count >= 2
//   ? `\n🔁 _Flagged in ${finding.consecutive_count} consecutive scans${finding.escalated_from ? ` — escalated from ${finding.escalated_from}` : ''}_`
//   : '';
```

### 5.3 Summary Line

In the main response text (before blocks), add:

```
"Recurring: POST /api/orders (SQL injection) flagged in 4 consecutive scans — escalated to Critical."
```

When any finding has `consecutive_count >= 2`.

### 5.4 Optional: `@Dispatch history /api/orders`

**New command:** Parse `history <endpoint>`, call `memory.getHistoryForEndpoint(targetId, endpoint)`, format as table.

**Requires:** `AgentConfig.targetId` or `targetDir` to resolve target.

---

## 6. Phase 5: PR Schema Enrichment

**Estimated:** 1 day

### 6.1 Constructor PR Flow

**Current:** `createFixPR(parsed, bootstrap, fixResult)` → `formatPRBody(parsed, fixResult, issueNumber)`.

**New:** Before creating PR, fetch memory context. Pass to `formatPRBody`.

### 6.2 Target ID for Constructor

Constructor has `bootstrap.github_repo` (e.g. `owner/repo`). Use that as `targetId` for memory queries.

### 6.3 Fingerprint from ParsedIssue

`ParsedIssue` has `location.endpoint`, `location.parameter`, `vuln_type`. Use `generateFindingFingerprint({ location: parsed.location, vuln_type: parsed.vuln_type })`.

### 6.4 createFixPR Changes (`workers/constructor/pr.ts`)

```ts
export async function createFixPR(
  parsed: ParsedIssue,
  bootstrap: ConstructorBootstrap,
  fixResult: FixResult,
): Promise<{ number: number; url: string; branch: string }> {
  // ... existing setup ...

  const memoryContext = await fetchMemoryContextForPR(bootstrap, parsed);

  const prBody = formatPRBody(parsed, fixResult, issueNumber, memoryContext);

  // ... create PR ...
}

async function fetchMemoryContextForPR(
  bootstrap: ConstructorBootstrap,
  parsed: ParsedIssue,
): Promise<MemoryContextForPR | null> {
  const store = getMemoryStore();
  if (!store) return null;

  const targetId = bootstrap.github_repo ?? bootstrap.github_issue?.repo;
  if (!targetId) return null;

  const fingerprint = generateFindingFingerprint({
    location: parsed.location,
    vuln_type: parsed.vuln_type,
  });

  const [history, consecutiveCounts] = await Promise.all([
    store.getHistoryForFinding(targetId, fingerprint, 10),
    store.getConsecutiveCounts(targetId, [fingerprint]),
  ]);

  if (history.length === 0) return null;

  const consecutiveCount = consecutiveCounts.get(fingerprint) ?? 0;

  return {
    consecutiveCount,
    history,
    escalatedFrom: parsed.escalated_from, // from issue body if stored
  };
}
```

### 6.5 formatPRBody Schema (Updated)

```ts
function formatPRBody(
  parsed: ParsedIssue,
  fixResult: FixResult,
  issueNumber?: number,
  memoryContext?: MemoryContextForPR | null,
): string {
  const issueRef = issueNumber ? `**Issue:** #${issueNumber}\n` : '';
  const fixesLine = issueNumber ? `\nFixes #${issueNumber}` : '';

  const severityLine = memoryContext?.escalatedFrom
    ? `**Vulnerability:** ${parsed.vuln_type} — ${parsed.severity} *(escalated from ${memoryContext.escalatedFrom} — flagged in ${memoryContext.consecutiveCount} consecutive scans)*`
    : `**Vulnerability:** ${parsed.vuln_type} — ${parsed.severity}`;

  const scanHistorySection = memoryContext && memoryContext.history.length >= 2
    ? formatScanHistoryTable(memoryContext.history, memoryContext.consecutiveCount)
    : '';

  return `## Dispatch Automated Fix

${issueRef}${severityLine}
**Location:** \`${parsed.location.file}:${parsed.location.line}\`

${scanHistorySection}

## What Changed
...
`;
}

function formatScanHistoryTable(history: FindingHistoryEntry[], consecutiveCount: number): string {
  const rows = history.map(h => `| ${h.run_id} | ${h.completed_at.slice(0, 10)} | ${h.severity} |`).join('\n');
  return `## Scan History

| Run | Date | Severity |
|-----|------|----------|
${rows}

This endpoint has been flagged in **${consecutiveCount} consecutive scans**. Severity was escalated to prioritize remediation.

`;
}
```

### 6.6 Documentation

Update `docs/communication-schemas.md` and `docs/agent-documentation-bundles.md` with the new PR body schema (Scan History section).

---

## 7. Phase 6: Dashboard & Optional Features

**Estimated:** 0.5–1 day (optional)

### 7.1 Dashboard

- Add "Recurring" badge to findings list when `consecutive_count >= 2`
- Optional: "Memory" tab showing last N runs per target

### 7.2 Retention / Prune

```ts
// memory/sqlite-store.ts
prune(targetId: string, keepLastDays?: number): Promise<number> {
  // Delete runs older than keepLastDays (default 90)
}
```

### 7.3 Optional Slack Commands

| Command | Implementation |
|---------|----------------|
| `@Dispatch history /api/orders` | Parse endpoint, call `getHistoryForEndpoint`, format blocks |
| `@Dispatch trends` | `getTopRecurringFindings(targetId, 5)` |

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Module | Tests |
|--------|-------|
| `memory/fingerprint.ts` | Same input → same output; different inputs → different |
| `memory/sqlite-store.ts` | recordRun, getConsecutiveCounts, getHistoryForFinding |
| `escalation.ts` | applyEscalation rules |
| `memory/config.ts` | resolveTargetId priority |

### 8.2 Integration Tests

| Test | Steps |
|------|-------|
| Orchestrator + memory | Run 3 scans on sample-app, verify 3rd run has consecutive_count=3 |
| PR + memory | Mock memory store, createFixPR, assert PR body contains Scan History |
| Slack + memory | Mock memory, handleSecurityScan, assert blocks include recurrence |

### 8.3 E2E (Manual)

1. `pnpm scan:sample` 3 times
2. Check `./.dispatch/memory.db` exists
3. `sqlite3 .dispatch/memory.db "SELECT * FROM runs;"` — 3 rows
4. Trigger fix via API
5. Open PR — verify Scan History section

---

## 9. Demo Script (Hackathon)

**Duration:** ~3 minutes

### 9.1 Setup

- Target: `flask-target` or `sample-app` (with known vuln)
- Slack connected
- GitHub repo configured

### 9.2 Script

1. **Run 1** — `@Dispatch scan` → "Found 1 finding (1 high)."
2. **Run 2** — `@Dispatch scan` → "Found 1 finding (1 high)."
3. **Run 3** — `@Dispatch scan` → "Found 1 finding (1 high)."
4. **Run 4** — `@Dispatch scan` → "Found 1 finding (1 critical). **Recurring:** `POST /api/orders` flagged in **4 consecutive scans** — escalated to Critical."
5. **Fix** — `@Dispatch fix issue #42` (or create issue first, then fix)
6. **PR** — Open PR, show Scan History table and escalation note.

### 9.3 Talking Points

- "Without memory, every scan treats findings in isolation."
- "With memory, the 4th consecutive flag triggers escalation to Critical."
- "The PR shows the scan history — reviewers see why this was prioritized."

---

## 10. Rollback & Feature Flags

### 10.1 Feature Flag

```ts
const MEMORY_ENABLED = process.env.DISPATCH_MEMORY_ENABLED !== 'false';
```

### 10.2 Rollback

- Set `DISPATCH_MEMORY_ENABLED=false` → no memory calls
- Delete `./.dispatch/memory.db` → fresh start
- No schema changes to existing tables; memory is additive

### 10.3 Graceful Degradation

- Memory store init fails → log warning, continue without memory
- `getConsecutiveCounts` fails → return empty Map, no escalation
- PR memory fetch fails → create PR without Scan History section

---

## 11. Milestone Summary

| Phase | Deliverable | Est. Days |
|-------|-------------|-----------|
| 1 | Memory store (SQLite + interface) | 1–2 |
| 2 | Orchestrator: recordRun, getConsecutiveCounts | 0.5–1 |
| 3 | Escalation logic | 1 |
| 4 | Slack: recurrence in findings + summary | 1 |
| 5 | PR: Scan History section | 1 |
| 6 | Dashboard + optional commands | 0.5–1 |
| **Total** | | **5–7 days** |

**Hackathon MVP:** Phases 1–5 (4–5 days) — core memory, escalation, Slack, PR.

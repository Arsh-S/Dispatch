# Dispatch — GitHub Issue Schema

This document defines the structured format for GitHub Issues created by Dispatch.
Issues serve as the **contract between pentester workers and construction workers.**

---

## Issue Title Format

```
[{SEVERITY}] {VULN_TYPE}: {ENDPOINT} — {SHORT_DESCRIPTION}
```

Examples:
- `[HIGH] SQL Injection: POST /api/orders — unsanitized user input in query builder`
- `[CRITICAL] Broken Auth: GET /api/admin/users — no authentication middleware`
- `[MEDIUM] XSS: POST /api/comments — reflected input in response body`

---

## Tagging System

Issues are tagged across **five independent axes**. Together, these tags tell you exactly where a finding stands in its lifecycle — from initial detection through to a merged fix.

### Axis 1: Exploit Confidence

Did the pentester actually trigger the vulnerability against the live app?

| Tag | Meaning | Issue quality |
|---|---|---|
| `exploit:confirmed` | Pentester triggered the vulnerability live. Reproduction steps, server logs, and server response prove it. | High — this is a real, proven vulnerability |
| `exploit:unconfirmed` | Code analysis suggests vulnerability, but the pentester couldn't trigger it live. Could be a WAF, unreachable code path, or wrong payload. | Lower — needs manual review. Still filed because the code pattern is suspicious |

### Axis 2: Monkeypatch Status

Did the pentester prove a fix direction works?

| Tag | Meaning | Construction worker impact |
|---|---|---|
| `monkeypatch:validated` | Monkeypatch applied, app restarted, re-attack failed. Fix direction is proven. | Best case — constructor has a working proof-of-concept to build on |
| `monkeypatch:failed` | Monkeypatch applied, but re-attack still succeeded or app broke. Fix approach didn't work. | Constructor must find its own fix approach. The failed diff is still documented as "what not to do" |
| `monkeypatch:not-attempted` | No monkeypatch was tried. Either the vuln type doesn't lend itself to quick patching (e.g., missing auth middleware), or the pentester ran out of time. | Constructor starts from scratch with only the vuln description and reproduction steps |

### Axis 3: Fix Status

Has a construction worker attempted a production fix? Updated by the construction worker, not the pentester.

| Tag | Meaning |
|---|---|
| `fix:unfixed` | No construction worker has been deployed. Default state after pentester files the issue. |
| `fix:in-progress` | Construction worker is currently running. |
| `fix:verified` | Construction worker opened a PR and validation passed. PR link in issue thread. |
| `fix:unverified` | Construction worker opened a PR but validation failed or was inconclusive. PR has warning label. |
| `fix:failed` | Construction worker couldn't produce a working fix. Notes in issue thread. |

### Axis 4: Classification

Static metadata about the vulnerability itself.

| Tag | Format | Example |
|---|---|---|
| Severity | `severity:{level}` | `severity:critical`, `severity:high`, `severity:medium`, `severity:low` |
| Vulnerability type | `vuln:{type}` | `vuln:sql-injection`, `vuln:xss`, `vuln:broken-auth` |
| OWASP classification | `owasp:{id}` | `owasp:A03-2021` |

### Axis 5: Dispatch Metadata

Operational tags linking the issue back to the scan.

| Tag | Format | Example |
|---|---|---|
| Dispatch run | `dispatch-run:{id}` | `dispatch-run:a3f8c` |
| Worker ID | `dispatch-worker:{id}` | `dispatch-worker:worker-injection-orders-7x2` |

---

## Tag Combinations — What They Mean

The exploit and monkeypatch axes combine to form **five distinct finding states**. Each state determines how much evidence the construction worker has to work with.

| State | Exploit | Monkeypatch | What the issue contains | Action |
|---|---|---|---|---|
| **Proven & fixable** | `confirmed` | `validated` | Full evidence + working fix PoC | Best candidate for construction worker. One-click fix. |
| **Proven, fix unknown** | `confirmed` | `failed` | Full evidence + failed fix attempt | Construction worker needs to find its own approach. Issue documents what didn't work. |
| **Proven, no fix tried** | `confirmed` | `not-attempted` | Full evidence, no fix PoC | Vuln is real. Construction worker starts from reproduction steps only. |
| **Suspected, no fix tried** | `unconfirmed` | `not-attempted` | Code analysis only, no live evidence | Needs human triage. May be false positive, may need different attack vector. |
| **Suspected, fix tried** | `unconfirmed` | `validated` | Code analysis + fix PoC that resolved the suspicious pattern | Unusual but possible — pentester couldn't trigger it, but patching the code pattern and re-testing showed behavioral change. |

### Dashboard / Slack Filtering Examples

```
# "Show me everything a construction worker can fix right now"
exploit:confirmed monkeypatch:validated fix:unfixed

# "Show me vulns that need human triage"
exploit:unconfirmed fix:unfixed

# "Show me everything from the latest scan"
dispatch-run:a3f8c

# "Show me critical findings that haven't been fixed"
severity:critical fix:unfixed

# "Show me all findings where the pentester proved the vuln but couldn't fix it"
exploit:confirmed monkeypatch:failed fix:unfixed
```

---

## Issue Body

### Metadata Block

```yaml
---
dispatch_run_id: dispatch-run-a3f8c
dispatch_worker_id: worker-injection-orders-7x2
timestamp: 2026-03-14T18:32:00Z
severity: HIGH
cvss_score: 8.1
owasp: A03:2021 Injection
vuln_type: SQL Injection
exploit_confidence: confirmed
monkeypatch_status: validated
fix_status: unfixed
---
```

### Vulnerability

| Field | Value |
|---|---|
| **File** | `src/routes/orders.js` |
| **Line** | 47 |
| **Endpoint** | `POST /api/orders` |
| **Method** | POST |
| **Affected Parameter** | `order_id` (request body) |

**Description:**
Plain-language explanation of what the vulnerability is and why it exists. Written by the pentester worker. Should reference the specific code pattern found.

> Example: "The `order_id` parameter is interpolated directly into a SQL query via string concatenation on line 47. An attacker can inject arbitrary SQL to read, modify, or delete data in the `orders` table."

---

### Reproduction

Step-by-step instructions to trigger the vulnerability. Must be copy-pasteable.

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid_token>" \
  -d '{"order_id": "1; DROP TABLE orders;--"}'
```

**Expected behavior:** 400 Bad Request or parameterized query escapes the input.
**Actual behavior:** 500 Internal Server Error — database error surfaced in response body, indicating raw SQL execution.

---

### Server Logs

Logs from the pentester's test run, filtered by `dispatch_worker_id`. Provides server-side evidence of the exploit.

```
[2026-03-14T18:32:01Z] INFO  POST /api/orders — 200 — dispatch_run_id=dispatch-run-a3f8c dispatch_worker_id=worker-injection-orders-7x2
[2026-03-14T18:32:01Z] ERROR QueryFailedError: syntax error at or near "DROP" — dispatch_run_id=dispatch-run-a3f8c dispatch_worker_id=worker-injection-orders-7x2
[2026-03-14T18:32:01Z] ERROR Unhandled exception in POST /api/orders — dispatch_run_id=dispatch-run-a3f8c dispatch_worker_id=worker-injection-orders-7x2
```

> Logs are pulled from the Dispatch middleware's `/_dispatch/logs` endpoint, filtered by `worker_id`. If Datadog forwarding is enabled (Phase 3), logs are also queryable via: `@dispatch_worker_id:worker-injection-orders-7x2`

---

### Monkeypatch

The diff applied by the pentester worker to validate that a fix approach works. This is a **proof of concept**, not production-ready code.

**Status:** `validated` | `failed` | `not-attempted`

```diff
--- a/src/routes/orders.js
+++ b/src/routes/orders.js
@@ -45,3 +45,3 @@
-  const result = await db.query(`SELECT * FROM orders WHERE id = '${req.body.order_id}'`);
+  const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.body.order_id]);
```

---

### Validation

What the pentester ran after applying the monkeypatch to confirm the fix works.

| Field | Value |
|---|---|
| **Test** | Replayed the same curl payload from Reproduction |
| **Result** | PASS — query parameterized, injection payload treated as literal string |
| **Response** | 200 OK — returned empty result set (no order with that ID) |
| **Side effects** | None observed — other order queries still functional |

**Post-patch server logs:**

```
[2026-03-14T18:32:05Z] INFO  POST /api/orders — 200 — dispatch_run_id=dispatch-run-a3f8c dispatch_worker_id=worker-injection-orders-7x2
```

> No error lines. Query executed safely.

---

### Recommended Fix

Notes from the pentester worker to the construction worker on how to implement a production-quality fix. This section bridges the gap between the monkeypatch (quick proof) and the real fix (follows codebase conventions).

> "I hardcoded a parameterized query as a direct replacement. The codebase already uses an ORM (`knex`) in `src/routes/users.js:23` — the construction worker should refactor this query to use the existing knex query builder instead of raw SQL. Also check `src/routes/products.js:61` which uses the same concatenation pattern."

---

### RULES.md Violations

Which rules from the project's `RULES.md` this finding violates, if any.

- `No raw SQL queries — must use parameterized statements`
- `Payment endpoints are critical priority`

---

## Schema Reference (JSON)

For programmatic creation via the GitHub Issues API, the structured data backing each issue:

```json
{
  "dispatch_run_id": "dispatch-run-a3f8c",
  "dispatch_worker_id": "worker-injection-orders-7x2",
  "timestamp": "2026-03-14T18:32:00Z",
  "severity": "HIGH",
  "cvss_score": 8.1,
  "owasp": "A03:2021",
  "vuln_type": "sql-injection",
  "exploit_confidence": "confirmed",
  "monkeypatch_status": "validated",
  "fix_status": "unfixed",
  "location": {
    "file": "src/routes/orders.js",
    "line": 47,
    "endpoint": "POST /api/orders",
    "method": "POST",
    "parameter": "order_id"
  },
  "description": "...",
  "reproduction": {
    "command": "curl -X POST ...",
    "expected": "400 Bad Request or parameterized escape",
    "actual": "500 Internal Server Error — raw SQL error surfaced"
  },
  "server_logs": [
    {
      "timestamp": "2026-03-14T18:32:01Z",
      "level": "ERROR",
      "message": "QueryFailedError: syntax error at or near \"Drop\""
    }
  ],
  "monkeypatch": {
    "diff": "...",
    "validation": {
      "test": "Replayed reproduction payload",
      "result": "PASS",
      "side_effects": "none"
    }
  },
  "recommended_fix": "...",
  "rules_violated": [
    "No raw SQL queries — must use parameterized statements"
  ]
}
```

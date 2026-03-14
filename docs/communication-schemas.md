# Dispatch — Orchestrator/Worker Communication Schemas

This document defines the structured JSON formats for all communication between the Orchestrator, Pentester Workers, and Construction Workers. JSON is used for all machine-readable fields. Freeform natural language is reserved for reasoning and strategic observations.

---

## 0. Orchestrator Pre-Recon Phase (Internal)

Before dispatching any workers, the Orchestrator runs a **code-analysis-only pass** — no live testing, no Blaxel containers. This produces the intelligence that informs task assignments.

### What Pre-Recon Does

1. Reads the full codebase (respecting `.dispatchignore`)
2. Reads `RULES.md`, developer-provided docs, API endpoint list
3. Builds a **route map**: every endpoint, its handler file/line, middleware chain, and parameters
4. Builds a **dependency graph**: which files import which, where the DB layer is, where auth is enforced
5. Identifies **high-risk patterns**: raw SQL concatenation, missing auth middleware, hardcoded secrets, eval/exec usage, unvalidated input
6. Produces a **pre-recon deliverable** — structured intelligence the orchestrator uses to build the attack matrix

### Pre-Recon Deliverable

```json
{
  "dispatch_run_id": "dispatch-run-a3f8c",
  "completed_at": "2026-03-14T18:29:00Z",

  "route_map": [
    {
      "endpoint": "POST /api/orders",
      "method": "POST",
      "handler_file": "src/routes/orders.js",
      "handler_line": 40,
      "middleware": ["auth", "rateLimit"],
      "parameters": [
        { "name": "order_id", "source": "body", "type": "string" },
        { "name": "quantity", "source": "body", "type": "string" }
      ]
    },
    {
      "endpoint": "GET /api/admin/users",
      "method": "GET",
      "handler_file": "src/routes/admin.js",
      "handler_line": 12,
      "middleware": [],
      "parameters": []
    }
  ],

  "risk_signals": [
    {
      "file": "src/routes/orders.js",
      "line": 47,
      "pattern": "raw-sql-concatenation",
      "snippet": "db.query(`SELECT * FROM orders WHERE id = '${req.body.order_id}'`)",
      "suggested_attack_types": ["sql-injection"]
    },
    {
      "file": "src/routes/admin.js",
      "line": 12,
      "pattern": "missing-auth-middleware",
      "snippet": "router.get('/admin/users', async (req, res) => {",
      "suggested_attack_types": ["broken-auth", "idor"]
    }
  ],

  "dependency_graph": {
    "db_layer": "src/db/connection.js",
    "orm": "knex (used in users.js, products.js — NOT in orders.js)",
    "auth_middleware": "src/middleware/auth.js",
    "session_store": "express-session with MemoryStore"
  },

  "briefing_notes": "The codebase is an Express app with 5 routes. Auth middleware exists but is not applied to /api/admin/*. The orders route uses raw SQL while the rest use knex. The session store is in-memory (MemoryStore), which is a known insecure default. JWT verification in auth.js does not check the algorithm field."
}
```

The orchestrator consumes this deliverable to build the attack matrix — deciding which (endpoint x attack_type) cells warrant a pentester worker. Risk signals directly inform which workers get spun up and what their briefings say.

---

## 1. Orchestrator → Pentester Worker (Task Assignment)

Sent when the Orchestrator spins up a Pentester Worker on Blaxel.

```json
{
  "dispatch_run_id": "dispatch-run-a3f8c",
  "worker_id": "worker-injection-orders-7x2",
  "assigned_at": "2026-03-14T18:30:00Z",
  "timeout_seconds": 300,

  "target": {
    "file": "src/routes/orders.js",
    "line_range": [40, 65],
    "endpoint": "POST /api/orders",
    "method": "POST",
    "parameters": ["order_id", "quantity"]
  },

  "attack_type": "sql-injection",

  "context": {
    "relevant_files": [
      "src/db/connection.js",
      "src/middleware/auth.js",
      "src/models/order.js"
    ],
    "api_keys": {
      "auth_token": "Bearer eyJhbGciOi..."
    },
    "rules_md": [
      "No raw SQL queries — must use parameterized statements",
      "Payment endpoints are critical priority"
    ],
    "developer_notes": "The orders endpoint handles payment processing. order_id comes from request body, not URL params."
  },

  "app_config": {
    "runtime": "node",
    "install": "npm install",
    "start": "npm run dev",
    "port": 3000,
    "seed": "npm run db:seed",
    "env": {
      "DATABASE_URL": "sqlite://local.db",
      "JWT_SECRET": "test-secret"
    }
  },

  "briefing": "Line 47 concatenates req.body.order_id directly into a SQL string using template literals. The db connection in src/db/connection.js uses the pg driver with no parameterization helper. The endpoint sits behind auth middleware (src/middleware/auth.js) so you'll need a valid token — one is provided in api_keys. The rest of the codebase uses knex for queries (see src/routes/users.js:23), but this file does raw SQL. Note this divergence in your recommended fix. Also check if the quantity parameter on line 52 has the same pattern."
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `dispatch_run_id` | string | yes | Unique ID for this entire Dispatch scan run |
| `worker_id` | string | yes | Unique ID for this specific worker instance |
| `assigned_at` | ISO 8601 | yes | When the task was assigned |
| `timeout_seconds` | integer | yes | Max time before the worker should abort and report back |
| `target.file` | string | yes | Primary file to investigate |
| `target.line_range` | [int, int] | no | Specific line range of interest within the file |
| `target.endpoint` | string | yes | The HTTP endpoint to test |
| `target.method` | string | yes | HTTP method |
| `target.parameters` | string[] | no | Known input parameters on this endpoint |
| `attack_type` | string | yes | What class of vulnerability to test for |
| `context.relevant_files` | string[] | yes | Additional files the worker should read for context |
| `context.api_keys` | object | no | Credentials needed to authenticate requests |
| `context.rules_md` | string[] | no | Relevant rules from the project's RULES.md |
| `context.developer_notes` | string | no | Freeform notes from the developer's spec/docs |
| `app_config` | object | yes | How to install, start, and seed the target app |
| `briefing` | string | yes | **Freeform.** Orchestrator's strategic reasoning about why this target was selected and what to look for |

### Valid `attack_type` Values

| Value | Description |
|---|---|
| `sql-injection` | SQL injection via string concatenation, template literals, ORM bypass |
| `xss` | Cross-site scripting — reflected, stored, DOM-based |
| `command-injection` | OS command injection via exec, spawn, system calls |
| `path-traversal` | Directory traversal via unsanitized file paths |
| `broken-auth` | Missing auth middleware, broken access control, privilege escalation |
| `jwt-tampering` | JWT signature bypass, expired token acceptance, algorithm confusion |
| `session-fixation` | Session ID reuse, session hijacking |
| `idor` | Insecure direct object references — accessing other users' resources |
| `secrets-exposure` | Hardcoded API keys, credentials in source, exposed .env files |
| `misconfigured-cors` | Overly permissive CORS headers |
| `insecure-headers` | Missing security headers (CSP, HSTS, X-Frame-Options) |
| `open-debug` | Exposed debug endpoints, stack traces in production responses |
| `rate-limiting` | Missing or bypassable rate limits on sensitive endpoints |
| `prompt-injection` | LLM prompt injection, system prompt leakage (for AI-powered apps) |
| `tool-poisoning` | Agent tool manipulation, goal hijacking (OWASP Agentic Top 10) |

---

## 2. Pentester Worker Internal Flow

The pentester worker operates in **two internal phases** within its Blaxel container. This is inspired by Shannon's queue-gated pattern — the worker does analysis first, then exploitation, with a structured decision point between them.

### Setup: Middleware Injection

Before any testing, the worker injects the Dispatch log middleware into the target app. This middleware:
- Reads `X-Dispatch-Worker-Id` headers from incoming requests
- Tags and captures all server-side logs (stdout, stderr, ORM queries, stack traces) for that request
- Exposes `GET /_dispatch/logs?worker_id=...` on localhost for the pentester to query
- Optionally forwards logs to Datadog (if API key is present in container env)
- Is a no-op for requests without Dispatch headers

This gives the pentester server-side visibility without any external API credentials. See `agent-documentation-bundles.md` Section 2.1 for the full middleware spec.

### Phase A: Vulnerability Analysis (Read + Attack)

The worker reads the code, starts the app, and attempts to exploit the target. After each attack, it queries `/_dispatch/logs` to see what happened server-side. This produces a **vulnerability queue** — a structured list of what it found, before any monkeypatching.

### Phase B: Monkeypatch Validation (Conditional)

Only runs if the vulnerability queue is non-empty. For each confirmed finding, the worker attempts a monkeypatch, restarts the app, and re-attacks to validate the fix direction.

```
┌─────────────────────────────────────────────┐
│            PENTESTER WORKER                  │
│                                              │
│  Setup: Inject Dispatch log middleware        │
│                                              │
│  Phase A: Analysis + Exploitation            │
│  ├─ Read assigned code context               │
│  ├─ Install deps, seed DB, start app         │
│  ├─ Attack endpoint with payloads            │
│  ├─ Query /_dispatch/logs for evidence       │
│  └─ Produce vulnerability queue              │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │ Vuln queue empty? → skip Phase B   │     │
│  │ Vuln queue has items? → continue   │     │
│  └─────────────────────────────────────┘     │
│                                              │
│  Phase B: Monkeypatch Validation             │
│  ├─ For each finding in queue:               │
│  │   ├─ Apply monkeypatch                    │
│  │   ├─ Restart app                          │
│  │   ├─ Re-attack with same payload          │
│  │   └─ Record result (validated/failed)     │
│  └─ Restore clean code state (git reset)     │
│                                              │
│  Produce final Finding Report                │
└─────────────────────────────────────────────┘
```

### Pentester Worker → Orchestrator (Finding Report)

Sent when the Pentester Worker completes its task. One report per worker, but a single worker can report multiple findings. Each finding now carries an `exploit_confidence` field reflecting whether the vuln was actually triggered live.

```json
{
  "dispatch_run_id": "dispatch-run-a3f8c",
  "worker_id": "worker-injection-orders-7x2",
  "completed_at": "2026-03-14T18:32:10Z",
  "status": "completed",
  "duration_seconds": 130,

  "error_detail": null,

  "findings": [
    {
      "finding_id": "finding-sql-orders-001",
      "severity": "HIGH",
      "cvss_score": 8.1,
      "owasp": "A03:2021",
      "vuln_type": "sql-injection",
      "exploit_confidence": "confirmed",

      "location": {
        "file": "src/routes/orders.js",
        "line": 47,
        "endpoint": "POST /api/orders",
        "method": "POST",
        "parameter": "order_id"
      },

      "description": "The order_id parameter is interpolated directly into a SQL query via string concatenation on line 47. An attacker can inject arbitrary SQL to read, modify, or delete data in the orders table.",

      "reproduction": {
        "steps": [
          "Send POST /api/orders with a valid auth token",
          "Set order_id to: 1; DROP TABLE orders;--",
          "Observe 500 Internal Server Error with database error in response body"
        ],
        "command": "curl -X POST http://localhost:3000/api/orders -H 'Content-Type: application/json' -H 'Authorization: Bearer eyJhbGciOi...' -d '{\"order_id\": \"1; DROP TABLE orders;--\"}'",
        "expected": "400 Bad Request or parameterized query escapes the input",
        "actual": "500 Internal Server Error — database error surfaced in response body, indicating raw SQL execution"
      },

      "server_logs": [
        {
          "timestamp": "2026-03-14T18:32:01Z",
          "level": "INFO",
          "message": "POST /api/orders — 200"
        },
        {
          "timestamp": "2026-03-14T18:32:01Z",
          "level": "ERROR",
          "message": "QueryFailedError: syntax error at or near \"Drop\""
        },
        {
          "timestamp": "2026-03-14T18:32:01Z",
          "level": "ERROR",
          "message": "Unhandled exception in POST /api/orders"
        }
      ],

      "monkeypatch": {
        "status": "validated",
        "diff": "--- a/src/routes/orders.js\n+++ b/src/routes/orders.js\n@@ -45,3 +45,3 @@\n-  const result = await db.query(`SELECT * FROM orders WHERE id = '${req.body.order_id}'`);\n+  const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.body.order_id]);",
        "validation": {
          "test": "Replayed reproduction payload after applying monkeypatch",
          "result": "PASS",
          "response": "200 OK — returned empty result set",
          "side_effects": "none"
        },
        "post_patch_logs": [
          {
            "timestamp": "2026-03-14T18:32:05Z",
            "level": "INFO",
            "message": "POST /api/orders — 200"
          }
        ]
      },

      "recommended_fix": "The monkeypatch hardcodes a parameterized query as a direct replacement. The codebase uses knex in src/routes/users.js:23 — the construction worker should refactor to use the existing knex query builder instead of raw SQL. Also check src/routes/products.js:61 which has the same concatenation pattern.",

      "rules_violated": [
        "No raw SQL queries — must use parameterized statements",
        "Payment endpoints are critical priority"
      ]
    },
    {
      "finding_id": "finding-info-disclosure-orders-002",
      "severity": "MEDIUM",
      "cvss_score": 5.3,
      "owasp": "A04:2021",
      "vuln_type": "info-disclosure",
      "exploit_confidence": "unconfirmed",

      "location": {
        "file": "src/routes/orders.js",
        "line": 80,
        "endpoint": "POST /api/orders",
        "method": "POST",
        "parameter": null
      },

      "description": "The error handler on line 80 appears to return raw database error messages to the client. During SQL injection testing, the 500 response included a QueryFailedError stack trace. However, this was observed as a side effect of the injection test — the information disclosure was not independently triggered or verified.",

      "reproduction": null,

      "server_logs": [],

      "monkeypatch": {
        "status": "not-attempted",
        "diff": null,
        "validation": null,
        "post_patch_logs": null
      },

      "recommended_fix": "The error handler should catch database errors and return a generic 500 response without exposing internal error details. Consider a centralized error handling middleware.",

      "rules_violated": []
    }
  ],

  "clean_endpoints": [
    {
      "endpoint": "POST /api/orders",
      "parameter": "quantity",
      "attack_type": "sql-injection",
      "notes": "quantity is cast to integer before use on line 52, not injectable"
    }
  ],

  "worker_notes": "The order_id injection is straightforward. quantity is safe due to parseInt() on line 52. I also noticed that the error handler on line 80 returns the raw database error message to the client — filed as an unconfirmed finding since I observed it during injection testing but didn't independently verify it."
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | yes | Worker-level execution status (see error classification below) |
| `error_detail` | object/null | no | Structured error info if `status` is not `completed` (see error classification) |
| `duration_seconds` | integer | yes | How long the worker ran |
| `findings` | array | yes | List of vulnerabilities found (can be empty) |
| `findings[].finding_id` | string | yes | Unique ID for deduplication |
| `findings[].severity` | string | yes | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `findings[].cvss_score` | float | no | CVSS v3.1 score if estimable |
| `findings[].exploit_confidence` | string | yes | `confirmed` (live exploit proven) or `unconfirmed` (code pattern suspicious but not triggered) |
| `findings[].monkeypatch.status` | string | yes | `validated`, `failed`, `not-attempted` |
| `findings[].reproduction` | object/null | yes | Null if `exploit_confidence` is `unconfirmed` and no reproduction was possible |
| `clean_endpoints` | array | no | Endpoints/parameters tested and found safe — proves the worker actually tested them |
| `worker_notes` | string | no | **Freeform.** Anything the worker observed that doesn't fit the structured fields — adjacent issues, anomalies, suggestions for the orchestrator |

### Valid `status` Values and Error Classification

Worker errors are classified into types so the orchestrator can decide how to handle them — retry, skip, or alert.

| Status | Error Type | Retryable | Meaning |
|---|---|---|---|
| `completed` | — | — | Worker finished its task within the timeout. Findings may be empty (clean). |
| `timeout` | `execution` | yes | Worker hit `timeout_seconds` before finishing. Partial results may be in `findings`. |
| `app_start_failed` | `environment` | yes | The target app failed to start — `npm install` failed, port conflict, missing env var, etc. |
| `app_crash` | `environment` | yes | The app started but crashed during testing and could not be restarted. |
| `network_error` | `network` | yes | Worker couldn't reach the target endpoint — DNS, firewall, or container networking issue. |
| `auth_failed` | `config` | no | Provided API keys / credentials were rejected. Orchestrator needs new credentials from dev. |
| `config_error` | `config` | no | Bad `app_config` — wrong start command, wrong port, missing seed script. Needs human fix. |
| `worker_error` | `internal` | no | Bug in the worker itself — LLM failure, OOM, unexpected exception. |

### Error Detail Object

When `status` is not `completed`, the `error_detail` field provides structured context:

```json
{
  "error_detail": {
    "type": "environment",
    "code": "app_start_failed",
    "message": "npm install exited with code 1: ERESOLVE unable to resolve dependency tree",
    "retryable": true,
    "phase": "setup",
    "suggestion": "Check that package.json dependencies are compatible with Node 22. Consider adding an .nvmrc or specifying the node version in app_config."
  }
}
```

---

## 3. Construction Worker (Standalone Job)

The Construction Worker is **not orchestrator-managed**. It is an independent job triggered by a developer from a GitHub Issue, Slack, or the dashboard. The GitHub Issue itself — written by the pentester via the Orchestrator — contains everything the Construction Worker needs. No intermediary.

### Trigger

A developer triggers a construction job by one of:
- Clicking **"Send Dispatch Workers"** on a GitHub Issue
- Slack: `"@Dispatch fix issue #42"`
- Dashboard: clicking **Fix** on a finding

### What the Construction Worker receives

The trigger mechanism passes a minimal bootstrap payload. Everything else is read directly from the GitHub Issue.

```json
{
  "construction_worker_id": "constructor-orders-fix-9k1",
  "triggered_at": "2026-03-14T19:00:00Z",
  "triggered_by": "slack",
  "timeout_seconds": 600,

  "github_issue": {
    "repo": "org/repo",
    "number": 42
  },

  "app_config": {
    "runtime": "node",
    "install": "npm install",
    "start": "npm run dev",
    "port": 3000,
    "seed": "npm run db:seed",
    "env": {
      "DATABASE_URL": "sqlite://local.db",
      "JWT_SECRET": "test-secret"
    }
  },

  "pr_config": {
    "base_branch": "main",
    "branch_prefix": "dispatch/fix"
  }
}
```

The Construction Worker then:
1. Fetches the GitHub Issue via API
2. Parses the structured metadata, monkeypatch, reproduction steps, and recommended fix from the issue body (see [github-issue-schema.md](./github-issue-schema.md))
3. Updates the issue tag from `fix:unfixed` → `fix:in-progress`
4. Clones the repo into its Blaxel container
5. Reads the relevant files referenced in the issue
6. Writes a production-quality fix informed by the monkeypatch and recommended fix
7. Starts the app, runs the reproduction command, validates the fix
8. Opens a PR and comments on the issue with the result
9. Updates the issue tag to `fix:verified`, `fix:unverified`, or `fix:failed`

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `construction_worker_id` | string | yes | Unique ID for this job |
| `triggered_at` | ISO 8601 | yes | When the job was triggered |
| `triggered_by` | string | yes | `slack`, `dashboard`, `github`, `api` |
| `timeout_seconds` | integer | yes | Max time before the worker should abort |
| `github_issue.repo` | string | yes | The repository (owner/name) |
| `github_issue.number` | integer | yes | The issue number — worker reads everything else from here |
| `app_config` | object | yes | How to install, start, and seed the target app |
| `pr_config` | object | yes | Branch naming conventions |

### Why the issue is the contract

The pentester's issue (see [github-issue-schema.md](./github-issue-schema.md)) already contains:
- The vulnerability location, type, and severity
- Exact reproduction steps with a copy-pasteable command
- The monkeypatch diff that proves a fix approach works
- The recommended fix describing how to do it properly
- The RULES.md violations to respect
- Datadog logs as evidence

Duplicating this into a separate assignment schema would create two sources of truth. The issue **is** the assignment. If a developer edits the issue (adds context, refines the recommended fix), the construction worker sees it automatically.

---

## 4. Construction Worker → GitHub Issue (Fix Report)

The Construction Worker does not report to the Orchestrator. It comments directly on the GitHub Issue and opens a PR. The issue thread becomes the full audit trail: pentester finding → construction attempt → result.

### Issue Comment (posted by the Construction Worker)

```markdown
## Dispatch Fix Report

**Status:** fix_verified
**Worker:** constructor-orders-fix-9k1
**Duration:** 330s

### PR
#43 — `dispatch/fix-sql-injection-orders-42`

### What Changed
- `src/routes/orders.js` — refactored raw SQL to use knex query builder
- `src/routes/products.js` — same fix (flagged by pentester in recommended fix)
- Added parseInt validation for order_id as defense-in-depth

### Validation
Ran the reproduction command from this issue after applying the fix:
```
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{"order_id": "1; DROP TABLE orders;--"}'
```
**Result:** PASS — 400 Bad Request (order_id must be an integer)
Injection payload rejected at input validation layer before reaching the database.

### Notes
The fix uses knex instead of raw parameterized queries, matching the convention in src/routes/users.js. Added parseInt validation as an additional defense layer per RULES.md.
```

### Structured data (for dashboard/API consumers)

The Construction Worker also emits a JSON payload for programmatic consumers (dashboard updates, Slack thread replies, etc.):

```json
{
  "construction_worker_id": "constructor-orders-fix-9k1",
  "completed_at": "2026-03-14T19:05:30Z",
  "status": "fix_verified",
  "duration_seconds": 330,

  "github_issue": {
    "repo": "org/repo",
    "number": 42
  },

  "pull_request": {
    "number": 43,
    "url": "https://github.com/org/repo/pull/43",
    "branch": "dispatch/fix-sql-injection-orders-42",
    "files_changed": [
      "src/routes/orders.js",
      "src/routes/products.js"
    ]
  },

  "validation": {
    "result": "PASS",
    "response": "400 Bad Request — order_id must be an integer"
  }
}
```

### Valid `status` Values

| Value | Meaning |
|---|---|
| `fix_verified` | Fix applied, validation passed, PR opened |
| `fix_unverified` | Fix applied, but validation failed or was inconclusive — PR opened with warning label |
| `fix_failed` | Could not produce a working fix — commented on issue with notes, no PR |
| `timeout` | Worker hit timeout before completing |
| `error` | Unrecoverable error (details in issue comment) |

---

## Message Flow Summary

```
═══════════════════════════════════════════════════════════════════
 PHASE 0: PRE-RECON (Orchestrator-internal, no Blaxel containers)
═══════════════════════════════════════════════════════════════════

Developer triggers scan
        │
        ▼
┌──────────────────────────────────────────────────────┐
│   ORCHESTRATOR — Pre-Recon                            │
│                                                      │
│  Reads codebase (respects .dispatchignore)           │
│  Reads RULES.md + developer docs                     │
│  Builds route map (endpoints → handlers → middleware)│
│  Builds dependency graph (DB, auth, sessions)        │
│  Identifies risk signals (raw SQL, missing auth...)  │
│  Produces pre-recon deliverable (JSON)               │
└────────────────────┬─────────────────────────────────┘
                     │
                     │  Pre-recon deliverable informs attack matrix
                     ▼

═══════════════════════════════════════════════════════════════════
 PHASE 1: PENTESTING (Orchestrator-dispatched, Blaxel containers)
═══════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────┐
│   ORCHESTRATOR — Planning                             │
│                                                      │
│  Uses pre-recon to build attack matrix               │
│  (endpoint × attack_type)                            │
│  Assigns only high-risk cells to workers             │
│  Creates task assignments with briefings             │
└────────────────────┬─────────────────────────────────┘
         │
         │  Schema 1: Task Assignment (JSON)
         │  One per pentester worker
         ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ PENTESTER A      │     │ PENTESTER B      │     │ PENTESTER C      │
│                  │     │                  │     │                  │
│ Blaxel container │     │ Blaxel container │     │ Blaxel container │
│                  │     │                  │     │                  │
│ Phase A: Attack  │     │ Phase A: Attack  │     │ Phase A: Attack  │
│ ├ Start app      │     │ ├ Start app      │     │ ├ Start app      │
│ ├ Hit endpoints  │     │ ├ Hit endpoints  │     │ ├ Hit endpoints  │
│ └ Build vuln Q   │     │ └ Build vuln Q   │     │ └ Build vuln Q   │
│                  │     │                  │     │                  │
│ [Queue empty?    │     │ [Queue empty?    │     │ [Queue empty?    │
│  Skip Phase B]   │     │  Skip Phase B]   │     │  Skip Phase B]   │
│                  │     │                  │     │                  │
│ Phase B: Patch   │     │ Phase B: Patch   │     │ Phase B: Patch   │
│ ├ Monkeypatch    │     │ ├ Monkeypatch    │     │ ├ Monkeypatch    │
│ ├ Restart app    │     │ ├ Restart app    │     │ ├ Restart app    │
│ ├ Re-attack      │     │ ├ Re-attack      │     │ ├ Re-attack      │
│ └ Record result  │     │ └ Record result  │     │ └ Record result  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │  Schema 2: Finding Report (JSON)
         │  Includes exploit_confidence per finding
         │  (confirmed | unconfirmed)
         ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                              │
│                                                                  │
│  Merges findings    →  Deduplicates    →  Ranks by severity     │
│  Handles errors by type (retry env errors, alert config errors) │
│  Creates GitHub Issues with tags:                               │
│    exploit:{confirmed|unconfirmed}                              │
│    monkeypatch:{validated|failed|not-attempted}                 │
│    fix:unfixed (default)                                        │
│  Generates PDF report                                           │
│  Populates dashboard                                            │
└──────────────────────────────────────────────────────────────────┘

         ┌─────────────────────────────────────────┐
         │  ORCHESTRATOR'S JOB IS DONE.             │
         │  Issues are the handoff artifact.        │
         │  Everything below is decoupled.          │
         └─────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
 PHASE 2: FIXING (Standalone, developer-triggered)
═══════════════════════════════════════════════════════════════════

Developer sees issue #42, triggers fix
(via GitHub, Slack, or dashboard)
        │
        │  Bootstrap payload (JSON) — just issue ref + app config
        ▼
┌──────────────────────┐
│ CONSTRUCTION WORKER   │
│                      │
│ Blaxel container     │
│ Fetches issue #42    │  ← reads the pentester's full report
│ Parses structured    │    directly from the GitHub Issue
│   finding data       │
│ Clones repo          │
│ Writes prod fix      │
│ Validates            │
│ Opens PR #43         │
│ Comments on issue    │  ← posts fix report as issue comment
└──────────────────────┘
         │
         │  Outputs (no orchestrator involved):
         │  • PR opened on GitHub
         │  • Fix report commented on issue #42
         │  • JSON payload emitted for dashboard/Slack
         ▼
┌──────────────────────────────────────────────┐
│  GitHub Issue #42 thread becomes the         │
│  full audit trail:                           │
│                                              │
│  1. Pentester finding (created by orch)      │
│  2. Construction fix report (commented)      │
│  3. PR #43 linked                            │
│  4. Developer review + merge                 │
└──────────────────────────────────────────────┘
```

# Dispatch — Agent Documentation Bundles

Each agent type receives a tailored documentation bundle when it spins up. These bundles contain only the API references, auth patterns, and schemas the agent needs — nothing more. Smaller context = better LLM performance.

---

## Documentation Matrix

| Doc | Orchestrator | Pentester Worker | Construction Worker |
|---|:---:|:---:|:---:|
| Blaxel API (create/manage containers) | yes | no | no |
| GitHub Issues API (create, label) | yes | no | no |
| GitHub Issues API (read, comment, relabel) | no | no | yes |
| GitHub PR API (create branch, open PR) | no | no | yes |
| Slack API (listen + respond) | yes | no | no |
| Dispatch Log Middleware API (localhost) | no | yes | no |
| Dispatch schemas (task assignment) | yes (writes) | yes (reads) | no |
| Dispatch schemas (finding report) | yes (reads) | yes (writes) | no |
| Dispatch schemas (issue format) | yes (writes) | no | yes (reads) |
| Dispatch schemas (fix report) | no | no | yes (writes) |
| Dispatch tagging system | yes (applies tags) | no | yes (updates tags) |
| Target app runtime docs | no | yes | yes |

---

## 1. Orchestrator Documentation Bundle

The Orchestrator is the integration hub. It talks to Blaxel, GitHub, Slack, and coordinates the entire scan lifecycle. It never touches the target app directly.

### 1.1 Blaxel API

**Purpose:** Spin up pentester worker containers, pass configuration, retrieve output.

**Endpoints needed:**

| Action | What the Orchestrator does |
|---|---|
| Create sandbox | Spin up a Blaxel container with the repo cloned, env vars set, and the task assignment JSON written to a known path |
| List sandboxes | Monitor active workers during a scan run |
| Get sandbox status | Poll for worker completion or detect failures |
| Get sandbox output | Retrieve the finding report JSON from a completed worker's filesystem |
| Delete sandbox | Tear down containers after collecting results |

**Auth:** Blaxel API key (stored as env var, never passed to workers)

**What the orchestrator needs to know:**
- How to clone a repo into a new sandbox
- How to set environment variables on sandbox creation (DATABASE_URL, JWT_SECRET, API keys for the target app)
- How to write a file into the sandbox at creation time (the task assignment JSON at `/dispatch/task-assignment.json`)
- How to read a file from a completed sandbox (the finding report JSON at `/dispatch/finding-report.json`)
- Container startup time (25ms) — informs parallelism decisions
- Timeout/kill behavior — what happens when `timeout_seconds` is exceeded

**Doc format:** API reference with request/response examples for each endpoint.

### 1.2 GitHub Issues API

**Purpose:** Create issues from pentester findings, apply the full tagging system.

**Endpoints needed:**

| Action | Endpoint | Notes |
|---|---|---|
| Create issue | `POST /repos/{owner}/{repo}/issues` | Body follows github-issue-schema.md |
| Add labels | `POST /repos/{owner}/{repo}/issues/{number}/labels` | Apply all 5 tag axes on creation |
| Create label | `POST /repos/{owner}/{repo}/labels` | First-run setup — create Dispatch label set if they don't exist |
| List labels | `GET /repos/{owner}/{repo}/labels` | Check which labels already exist |

**Auth:** GitHub token with `repo` scope (issues, labels)

**What the orchestrator needs to know:**
- How to format issue body as markdown (the full github-issue-schema.md template)
- Label creation with color coding:
  - `exploit:confirmed` → green
  - `exploit:unconfirmed` → yellow
  - `monkeypatch:validated` → green
  - `monkeypatch:failed` → red
  - `monkeypatch:not-attempted` → gray
  - `fix:unfixed` → red
  - `severity:critical` → dark red
  - `severity:high` → red
  - `severity:medium` → orange
  - `severity:low` → yellow
- Rate limits (5000 requests/hour for authenticated requests)
- How to include the structured JSON schema reference block in the issue body

**Doc format:** GitHub REST API reference for Issues + Labels, plus the full Dispatch issue schema.

### 1.3 Slack API

**Purpose:** Receive scan triggers, post results to threads.

**Endpoints needed:**

| Action | What | Notes |
|---|---|---|
| Listen for mentions | Events API / Socket Mode | Trigger: `@Dispatch scan ...` or `@Dispatch fix issue #42` |
| Post message | `POST chat.postMessage` | Scan started confirmation, progress updates |
| Reply in thread | `POST chat.postMessage` (with `thread_ts`) | Results posted as thread replies, not channel spam |
| Upload file | `POST files.upload` | Attach PDF report to thread |

**Auth:** Slack Bot Token (`xoxb-...`) with scopes: `chat:write`, `files:write`, `app_mentions:read`

**What the orchestrator needs to know:**
- How to parse the trigger message to extract: repo name, scan scope, specific issue number (for fix triggers)
- How to format results as Slack Block Kit messages (severity color coding, collapsible sections)
- Thread model — all replies to a scan go in the same thread
- How to post a summary with links to GitHub Issues and the dashboard
- Rate limits (1 message/second per channel)

**Message templates needed:**
```
Scan started:
"Starting Dispatch scan on {repo}. Orchestrator analyzing codebase..."

Pre-recon complete:
"Found {n} routes, {m} risk signals. Dispatching {k} pentester workers."

Scan complete:
"Scan complete. {x} findings ({c} critical, {h} high, {m} medium, {l} low).
{y} issues created. PDF report attached.
[View Dashboard →]"

Fix triggered:
"Construction worker deployed for issue #{n}. Will report back here when done."

Fix complete:
"Fix for issue #{n}: {status}. PR #{pr} opened.
[View PR →]"
```

**Doc format:** Slack API reference for Events API + chat.postMessage + files.upload + Block Kit formatting.

### 1.4 Dispatch Internal Schemas

The Orchestrator needs to understand both sides of every communication:

| Schema | Role |
|---|---|
| Pre-recon deliverable (Section 0 of communication-schemas.md) | Produces this |
| Task assignment (Schema 1) | Produces this, writes to Blaxel sandbox |
| Finding report (Schema 2) | Reads this from completed Blaxel sandboxes |
| GitHub issue format (github-issue-schema.md) | Produces this from finding reports |
| Tagging system (github-issue-schema.md) | Applies tags on issue creation |

---

## 2. Pentester Worker Documentation Bundle

The pentester is the simplest agent in terms of external integrations. It runs inside a Blaxel container, attacks localhost, reads logs via the Dispatch middleware, and writes a JSON report. No GitHub, no Slack, no Blaxel API, no direct Datadog access.

### 2.1 Dispatch Log Middleware

**Purpose:** Read server-side logs from the pentester's own test runs to gather evidence of exploits.

The pentester does **not** talk to Datadog directly. Instead, the Dispatch middleware — injected into the target app at container startup (see below) — handles log collection and exposes a local API the pentester can query.

#### How it works

```
Pentester sends request
    │
    │  X-Dispatch-Run-Id: dispatch-run-a3f8c
    │  X-Dispatch-Worker-Id: worker-injection-orders-7x2
    ▼
┌──────────────────────────────────────────────────────┐
│                 TARGET APP                            │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  DISPATCH MIDDLEWARE (injected at startup)    │   │
│  │                                              │   │
│  │  1. Reads X-Dispatch-* headers               │   │
│  │  2. Tags all logs from this request with     │   │
│  │     dispatch_run_id + dispatch_worker_id     │   │
│  │  3. Captures log output (stdout, stderr,     │   │
│  │     ORM queries, error stack traces)         │   │
│  │  4. Stores in local buffer, keyed by         │   │
│  │     worker_id                                │   │
│  │  5. Forwards to Datadog with same tags       │   │
│  │     (for orchestrator dashboard/PDF later)   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  GET /_dispatch/logs?worker_id=...           │   │
│  │  GET /_dispatch/logs?worker_id=...&level=ERROR│  │
│  │  GET /_dispatch/logs?worker_id=...&since=ts  │   │
│  │                                              │   │
│  │  Returns logs only for the requesting worker │   │
│  │  Filtered by worker_id — can't see other     │   │
│  │  workers' logs or production traffic         │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

#### Local log endpoint

| Endpoint | Method | Description |
|---|---|---|
| `/_dispatch/logs` | GET | Returns logs for a specific worker |

**Query parameters:**

| Param | Required | Description |
|---|---|---|
| `worker_id` | yes | Only returns logs tagged with this worker ID |
| `level` | no | Filter by log level: `ERROR`, `WARN`, `INFO`, `DEBUG` |
| `since` | no | ISO 8601 timestamp — only logs after this time |
| `limit` | no | Max number of log entries (default: 100) |

**Response format:**

```json
{
  "worker_id": "worker-injection-orders-7x2",
  "log_count": 3,
  "logs": [
    {
      "timestamp": "2026-03-14T18:32:01Z",
      "level": "INFO",
      "source": "express",
      "message": "POST /api/orders — 200"
    },
    {
      "timestamp": "2026-03-14T18:32:01Z",
      "level": "ERROR",
      "source": "pg",
      "message": "QueryFailedError: syntax error at or near \"Drop\""
    },
    {
      "timestamp": "2026-03-14T18:32:01Z",
      "level": "ERROR",
      "source": "express",
      "message": "Unhandled exception in POST /api/orders",
      "stack": "Error: QueryFailedError...\n    at Object.query (src/db/connection.js:12:5)\n    at handler (src/routes/orders.js:47:22)"
    }
  ]
}
```

**Auth:** None — the endpoint is localhost-only inside the Blaxel container. Not exposed externally.

#### Key usage pattern

```
1. Record timestamp before sending attack payload
2. Send attack payload to target app (include X-Dispatch-Worker-Id header)
3. Read HTTP response (status code, body)
4. GET /_dispatch/logs?worker_id={self}&since={timestamp}&level=ERROR
5. Parse logs to understand what happened server-side
6. Include relevant log entries in the finding report
```

#### Why the pentester needs server-side logs (not just HTTP responses)

- A **500 response** tells you *something* broke. The log shows `QueryFailedError: syntax error at or near "Drop"` — proof the injection reached the database.
- A **200 response** might hide a successful injection — data exfiltrated in the response body, but the log shows the injected query actually executed.
- **Auth bypass** attempts may return 200 regardless — the log shows whether the auth middleware was actually invoked.
- **Information disclosure**: the response may be sanitized by an error handler, but the log captures the full error before the handler strips it.
- **Stack traces** in logs pinpoint exactly which line of code was hit — this goes directly into the finding's `location` field.

#### Middleware injection

The Dispatch middleware is monkeypatched into the target app by the pentester worker at container startup, **before any testing begins**. This is the same monkeypatching muscle the worker uses for fixes later.

For an Express app, the middleware is injected as the first middleware in the chain:
```javascript
// Injected by Dispatch at container startup
app.use(dispatchLogMiddleware());
```

The middleware:
1. Intercepts `X-Dispatch-*` headers on incoming requests
2. Wraps the app's logger to tag all output with the worker ID
3. Captures ORM/database query logs
4. Captures unhandled exceptions with stack traces
5. Stores everything in an in-memory buffer keyed by `worker_id`
6. Exposes `/_dispatch/logs` endpoint for local queries
7. Optionally forwards to Datadog (if `DATADOG_API_KEY` env var is present) for persistence beyond the container lifecycle
8. Is a **no-op** for requests without `X-Dispatch-*` headers (production traffic passes through untouched)

**Doc format:** The middleware API reference above is the entire doc. No external API credentials needed.

### 2.2 Target App Runtime

**Purpose:** Install, seed, start, restart, and interact with the target application.

**Not a fixed API doc** — this comes from the `app_config` block in the task assignment. But the pentester needs to understand:

| Concept | What the pentester needs to know |
|---|---|
| Runtime detection | How to interpret `app_config.runtime` (node, python, go, etc.) |
| Dependency installation | Run `app_config.install` and handle failures |
| Database seeding | Run `app_config.seed` if present |
| App startup | Run `app_config.start`, wait for `app_config.port` to accept connections |
| App restart | Kill the process, re-run `app_config.start` (needed after monkeypatching) |
| Health check | How to detect the app is ready (poll the port, check for startup log line) |
| Git reset | Restore clean state after monkeypatching (`git checkout -- .`) before trying the next patch |

### 2.3 Dispatch Internal Schemas

| Schema | Role |
|---|---|
| Task assignment (Schema 1) | Reads this from `/dispatch/task-assignment.json` at startup |
| Finding report (Schema 2) | Produces this, writes to `/dispatch/finding-report.json` at completion |
| Vulnerability queue (internal) | Produces after Phase A, consumes in Phase B |
| Error classification | Reports structured errors when things go wrong |

---

## 3. Construction Worker Documentation Bundle

The construction worker is a standalone job triggered by a developer. It reads from GitHub (the issue), writes to GitHub (PR + comment), and runs the target app locally for validation. No Blaxel API (it runs inside Blaxel but doesn't manage containers), no Slack (the dashboard/Slack layer reads the issue thread), no Datadog.

### 3.1 GitHub Issues API

**Purpose:** Read the pentester's finding from the issue body, update tags, post fix report.

**Endpoints needed:**

| Action | Endpoint | Notes |
|---|---|---|
| Get issue | `GET /repos/{owner}/{repo}/issues/{number}` | Parse the structured finding from the issue body |
| Add comment | `POST /repos/{owner}/{repo}/issues/{number}/comments` | Post the fix report |
| Replace labels | `PUT /repos/{owner}/{repo}/issues/{number}/labels` | Update `fix:unfixed` → `fix:in-progress` → `fix:verified` etc. |
| Remove label | `DELETE /repos/{owner}/{repo}/issues/{number}/labels/{name}` | Remove old fix status before applying new one |

**Auth:** GitHub token with `repo` scope

**What the construction worker needs to know:**
- How to parse the structured metadata block (YAML frontmatter) from the issue body
- How to extract the monkeypatch diff, reproduction command, and recommended fix sections
- How to handle each `exploit_confidence` × `monkeypatch_status` combination:

| Combination | Construction worker strategy |
|---|---|
| `confirmed` + `validated` | Best case. Read the monkeypatch diff, understand the approach, write a production-quality version following codebase conventions. Use the reproduction command to validate. |
| `confirmed` + `failed` | Vuln is real. The failed monkeypatch tells you what didn't work — avoid that approach. Read the recommended fix for alternative ideas. Start from the reproduction steps. |
| `confirmed` + `not-attempted` | Vuln is real, no fix hint. Read the description and reproduction steps. Analyze the code pattern yourself. Write fix from scratch. |
| `unconfirmed` + `not-attempted` | Risky. Code pattern looks suspicious but wasn't proven exploitable. Attempt to reproduce first. If you can't trigger it, fix the code pattern anyway (defensive) but flag the PR as `fix:unverified`. |
| `unconfirmed` + `validated` | Unusual. The code pattern was patched and behavior changed, but the original exploit was never confirmed. Apply the same fix approach, flag as `fix:unverified`. |

- Fix status tag lifecycle:
  1. On job start: remove `fix:unfixed`, add `fix:in-progress`
  2. On success: remove `fix:in-progress`, add `fix:verified`
  3. On inconclusive: remove `fix:in-progress`, add `fix:unverified`
  4. On failure: remove `fix:in-progress`, add `fix:failed`

**Doc format:** GitHub REST API reference for Issues (get, comment, labels).

### 3.2 GitHub Pull Requests API

**Purpose:** Create a branch, push the fix, and open a PR linked to the issue.

**Endpoints needed:**

| Action | Endpoint/Command | Notes |
|---|---|---|
| Create branch | `git checkout -b dispatch/fix-{vuln_type}-{endpoint}-{issue_number}` | Local git, then push |
| Push branch | `git push -u origin {branch_name}` | Sets upstream |
| Create PR | `POST /repos/{owner}/{repo}/pulls` | Links to issue via `Fixes #{number}` in body |

**Auth:** Same GitHub token as Issues API

**What the construction worker needs to know:**
- Branch naming convention: `dispatch/fix-{vuln_type}-{short_endpoint}-{issue_number}`
  - Example: `dispatch/fix-sql-injection-orders-42`
- PR title format: `[Dispatch] Fix {vuln_type} in {METHOD} {endpoint}`
  - Example: `[Dispatch] Fix SQL injection in POST /api/orders`
- PR body structure:

```markdown
## Dispatch Automated Fix

**Issue:** #{issue_number}
**Vulnerability:** {vuln_type} — {severity}
**Location:** `{file}:{line}`

## What Changed

{description of the changes, referencing specific files}

## Validation

Ran the reproduction command from issue #{issue_number}:
```
{reproduction_command}
```

**Result:** {PASS/FAIL} — {response description}

## Notes

{any additional context about the fix approach, codebase conventions followed, etc.}

---
*Automated fix by [Dispatch](https://github.com/org/dispatch). Review before merging.*
```

- How to use `Fixes #{number}` to auto-close the issue when the PR is merged
- How to add labels to the PR: `dispatch-fix`, `automated`, severity label
- Base branch comes from `pr_config.base_branch` in the bootstrap payload

**Doc format:** GitHub REST API reference for Pulls (create), plus git branching commands.

### 3.3 Target App Runtime

Same as the pentester worker — the construction worker also needs to install, seed, start, and test the app to validate its fix. See Section 2.2.

### 3.4 Dispatch Internal Schemas

| Schema | Role |
|---|---|
| GitHub issue format (github-issue-schema.md) | Reads this — parses the finding from issue body |
| Tagging system (github-issue-schema.md) | Updates fix status tags |
| Fix report comment format (Schema 4 of communication-schemas.md) | Produces this — posts as issue comment |
| Bootstrap payload (Schema 3 of communication-schemas.md) | Reads this at startup |

---

## Bundle Size Estimates

Keeping context lean matters for LLM performance. Rough estimates of each bundle:

| Agent | External API docs | Internal schema docs | Total context |
|---|---|---|---|
| **Orchestrator** | Blaxel API + GitHub Issues/Labels + Slack Events/Messages | Pre-recon + Task Assignment + Finding Report + Issue Schema + Tagging | Largest — but runs on a persistent sandbox, not ephemeral |
| **Pentester Worker** | None (log middleware is localhost) | Task Assignment + Finding Report + Error Classification + Middleware API | Smallest — zero external credentials, fully self-contained |
| **Construction Worker** | GitHub Issues + GitHub PRs | Issue Schema + Tagging + Fix Report + Bootstrap | Medium — needs to parse issue body and manage PR lifecycle |

---

## Auth Credential Distribution

Each agent only receives the credentials it needs. No agent gets the full set.

| Credential | Orchestrator | Pentester | Construction |
|---|:---:|:---:|:---:|
| Blaxel API key | yes | no | no |
| GitHub token (repo scope) | yes | no | yes |
| Slack bot token | yes | no | no |
| Datadog API key | yes (for dashboard/PDF enrichment) | no | no |
| Datadog Application key | yes | no | no |
| Target app env vars (DB, secrets) | passes through | yes (in container) | yes (in container) |

**Note:** The pentester worker has **zero external credentials**. It only talks to localhost — the target app and the Dispatch log middleware running inside the same Blaxel container. Datadog forwarding happens inside the middleware (if `DATADOG_API_KEY` is present in the container env), but the pentester agent itself never touches the Datadog API. The orchestrator handles any Datadog queries needed for dashboard enrichment or PDF reports after collecting the finding reports.

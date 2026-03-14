# Dispatch — Implementation Plan

> **Generated:** 2026-03-14
> **Context:** Cornell AI Hackathon NYC 2026 | AI Unleashed | Alignment at Scale Track
> **Timeline:** 36 hours (Friday 6 PM → Sunday 9:10 AM)

> **PREREQUISITE — Before executing any phase of this plan, run the `/prime` command to initialize your understanding of the codebase architecture. Do not proceed until priming is complete.**

---

## Build-Time MCP Configuration

> **CRITICAL — Configure these MCPs in Claude Code BEFORE starting implementation. They provide live documentation access that prevents API hallucination.**

```json
{
  "mcpServers": {
    "mastra-docs": {
      "command": "npx",
      "args": ["-y", "@mastra/mcp-docs-server"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

| MCP | What It Provides | Used In |
|---|---|---|
| `@mastra/mcp-docs-server` v1.1.10 | Full Mastra docs, TypeScript types, code examples, API surface | Tasks 1.1, 1.3, 1.4, 1.5, 2.1, 2.3 |
| `@upstash/context7-mcp` | Live docs for Express.js, Octokit, Slack Bolt | Tasks 1.1, 1.2, 1.6, 2.1, 3.1 |

**First action after configuring MCPs:** Run `resolve-library-id` via Context7 for: `mastra`, `blaxel`, `slack-bolt`. Submit any missing libraries at `context7.com/add-library`.

> **Runtime MCP (for Dispatch agents):** Only **GitHub MCP** (`github/github-mcp-server`) is used at runtime for issue/label/PR operations. All other MCPs (Slack, Linear, Datadog, ZAP, Playwright, etc.) are Phase 3 stretch goals — do not configure until Phase 1-2 are complete.

---

## Clarification Questions (Resolved)

Research has resolved most ambiguities. Remaining minor decisions:

1. **Package manager**: Use **pnpm** for all TypeScript packages. Provides strict dependency isolation (symlinked `node_modules` — the TS equivalent of Python venvs), disk efficiency, and deterministic installs. Install via `corepack enable && corepack prepare pnpm@latest --activate`. All commands below use `pnpm` instead of `npm`.
2. **Mastra version**: Use `@mastra/core` **v1.10.0**. Agent pattern: `new Agent({ name, instructions, model, tools })`. Scaffold via `pnpm create mastra@latest`.
3. **OpenRouter model selection**: Claude Sonnet 4.6 for pentester workers (fast, good at tool use), Claude Opus 4.6 for orchestrator pre-recon (deep reasoning), Claude Haiku 4.5 for report generation (cheap, fast). Use string notation: `"openrouter/anthropic/claude-sonnet-4"` — no extra package needed.
4. **Blaxel SDK**: TypeScript SDK confirmed — `@blaxel/core` v0.2.66 + `@blaxel/mastra` v0.2.43. Provides `SandboxInstance.createIfNotExists()`, `sandbox.fs.*`, `sandbox.process.exec()`. Each sandbox auto-exposes MCP at `<sandbox-url>/mcp`.
5. **Sample vulnerable app**: Custom Express app (painfully simple — 4-5 routes, SQLite, minimal code). Enables full middleware injection and monkeypatch validation.
6. **Dashboard hosting**: Local Vite dev server. Dashboard reads from static `dispatch-output.json` written by orchestrator (polled every 2s). No WebSocket/SSE needed.
7. **Scan entry point**: CLI via `src/cli.ts` — `pnpm tsx src/cli.ts scan <path-to-repo>`. Invokes orchestrator, writes `dispatch-output.json` on completion.
8. **Schema validation**: Use **Zod** for all schemas. Provides runtime validation + TypeScript type inference from a single source.
9. **Auth token for pentester**: Seed script generates a JWT signed with the known `JWT_SECRET` and writes it to `sample-app/test-token.txt`. Orchestrator reads this and includes it in task assignments.

> **Note on Python:** This project is entirely TypeScript. If any Python tooling is added later (e.g., ZAP scripting, ML-based analysis), use **uv** (`astral-sh/uv`) for virtual environments and dependency management.

---

## Dependency Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY GRAPH                              │
│                                                                  │
│  Sample Vulnerable App ─────┐                                   │
│                              ├──► Dispatch Log Middleware        │
│  Mastra Project Scaffold ───┤                                   │
│                              ├──► Orchestrator Agent             │
│  Blaxel Account + API Key ──┤    ├── Pre-Recon Logic            │
│                              │    ├── Attack Matrix Builder      │
│  OpenRouter API Key ────────┤    └── Worker Dispatcher           │
│                              │                                   │
│  GitHub Token ──────────────┤──► Pentester Worker Agent          │
│                              │    ├── Middleware Injection        │
│                              │    ├── Attack Phase                │
│                              │    └── Monkeypatch Phase           │
│                              │                                   │
│                              ├──► GitHub Issue Creator            │
│                              │    └── Tagging System Setup        │
│                              │                                   │
│                              ├──► Dashboard (React)              │
│                              │                                   │
│                              ├──► Construction Worker Agent       │
│                              │                                   │
│                              └──► PDF Report Generator           │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Path (Must-Have)

```
Sample App → Middleware → Orchestrator Pre-Recon → Attack Matrix →
Pentester Worker → Finding Report → Issue Creator → Dashboard
```

Each step depends on the previous. The sample app MUST be done first — everything tests against it.

### Parallel Tracks (after Sample App is done)

- Dashboard can be built in parallel once the finding report JSON schema is known (it is — see communication-schemas.md)
- GitHub Issue creation can be built in parallel with pentester workers (uses the same schema)

### External Dependencies / Blockers

| Dependency | Status | Blocker? | Mitigation |
|---|---|---|---|
| `.env` file with all keys | ✅ Confirmed in `.env` (2026-03-14) | No | All three blocking keys present and loadable |
| Blaxel account + API key (`BL_API_KEY`) | ✅ Set in `.env` (2026-03-14) | No | Confirmed accessible |
| OpenRouter API key (`OPENROUTER_API_KEY`) | ✅ Set in `.env` (2026-03-14) | No | Confirmed accessible |
| GitHub PAT (`GITHUB_TOKEN`, `repo` scope) | ✅ Set in `.env` (2026-03-14) | No | Confirmed accessible. **Used by GitHub MCP server** |
| Mastra (`@mastra/core` v1.10.0) | Needed for Phase 1 | No | `pnpm create mastra@latest` |
| Slack bot token (`xoxb-...`) + Team ID | Needed for Phase 3 only | No | Nice-to-have, not on critical path |
| Datadog API + App keys | Needed for Phase 3 only | No | Nice-to-have |
| Linear API key | Needed for Phase 3 only | No | Nice-to-have |

---

## Phase 1: MVP / Foundational (Friday 6 PM → Saturday 12 PM)

**Goal:** Orchestrator reads code → dispatches 2 pentester workers → collects findings → creates GitHub Issues with tagging system → dashboard shows findings.

### Task 1.1: Project Scaffold + Sample Vulnerable App

**Time estimate context:** First thing built. Everything depends on it.

> **📖 Documentation sources:**
> - **`@mastra/mcp-docs-server`** → Query for: project scaffolding, `Mastra` class, agent registration, tool registration
> - **Context7** → `resolve-library-id: express` for Express.js middleware patterns

- [ ] Initialize Mastra project with TypeScript (`pnpm create mastra@latest`)
- [ ] Set up project structure:
  ```
  dispatch/
  ├── src/
  │   ├── orchestrator/       # Orchestrator agent
  │   ├── workers/
  │   │   ├── pentester/      # Pentester worker agent
  │   │   └── constructor/    # Construction worker (Phase 2)
  │   ├── middleware/          # Dispatch log middleware
  │   ├── schemas/            # JSON schemas (from docs/)
  │   ├── github/             # GitHub Issues/PR integration
  │   ├── dashboard/          # React dashboard
  │   └── utils/              # Shared utilities
  ├── sample-app/             # Deliberately vulnerable Express app
  ├── docs/                   # Existing brainstorming docs
  ├── agent/                  # Agent plans
  └── package.json
  ```
- [ ] Build sample vulnerable Express app with 4-5 routes:
  - `POST /api/orders` — SQL injection (string concatenation in query, line ~47)
  - `GET /api/admin/users` — missing auth middleware (no authentication check)
  - `POST /api/comments` — XSS (reflected input in response body)
  - `GET /api/users/:id` — IDOR (no ownership check, returns any user's data)
  - `POST /api/login` — JWT with weak secret, no algorithm verification
- [ ] Add `RULES.md` to sample app:
  ```
  - All API endpoints must require authentication
  - No raw SQL queries — must use parameterized statements
  - JWT tokens must verify signature and check expiration
  - No hardcoded API keys or secrets in source files
  - Payment endpoints are critical priority
  ```
- [ ] Add `.dispatchignore` to sample app (`node_modules`, `package-lock.json`, etc.)
- [ ] Add `dispatch.config` with app runtime info:
  ```yaml
  runtime: node
  install: pnpm install
  start: pnpm dev
  port: 3000
  seed: pnpm db:seed
  ```
- [ ] Seed script generates a test JWT signed with `JWT_SECRET` and writes to `sample-app/test-token.txt`
- [ ] Verify sample app starts, has a SQLite database, and seed script populates test data

**Impacted files:**
- `sample-app/` (new directory, ~8-10 files)
- `sample-app/RULES.md`
- `sample-app/.dispatchignore`
- `sample-app/dispatch.config.yaml`
- `package.json` (root project setup)
- `tsconfig.json`

### Task 1.2: Dispatch Log Middleware

**Time estimate context:** Must be done before pentester workers can test.

> **📖 Documentation sources:**
> - **Context7** → `resolve-library-id: express` for Express middleware patterns (`app.use()`, `req`, `res`, `next`)
> - **Context7** → `resolve-library-id: better-sqlite3` for DB query interception
> - Internal ref: `agent-documentation-bundles.md` Section 2.1 for response format spec

- [ ] Build Express middleware package (`src/middleware/dispatch-log-middleware.ts`):
  - Reads `X-Dispatch-Run-Id` and `X-Dispatch-Worker-Id` headers
  - Wraps console.log/console.error to capture tagged output
  - Intercepts ORM/database query logs (hook into pg/sqlite driver)
  - Captures unhandled exceptions with stack traces
  - Stores logs in in-memory Map keyed by `worker_id`
  - Exposes `GET /_dispatch/logs` endpoint (query params: `worker_id`, `level`, `since`, `limit`)
  - No-op for requests without `X-Dispatch-*` headers
- [ ] Response format matches spec in `agent-documentation-bundles.md` Section 2.1:
  ```json
  {
    "worker_id": "...",
    "log_count": 3,
    "logs": [
      { "timestamp": "...", "level": "ERROR", "source": "pg", "message": "...", "stack": "..." }
    ]
  }
  ```
- [ ] Test: inject middleware into sample app, send request with headers, verify logs appear at `/_dispatch/logs`
- [ ] Build injection via Node.js `-r` preload script (`src/middleware/dispatch-preload.js`):
  - Monkeypatches `require('express')` to wrap the returned `express()` factory
  - Wrapped factory auto-inserts `dispatchLogMiddleware()` as the first middleware via `app.use()`
  - Usage: `node -r ./src/middleware/dispatch-preload.js app.js` (pentester worker uses this to start target app)
  - Falls back gracefully if app doesn't use Express (no-op)

**Impacted files:**
- `src/middleware/dispatch-log-middleware.ts` (new)
- `src/middleware/dispatch-preload.js` (new — `-r` preload script that patches Express require)
- `src/middleware/types.ts` (new — log entry types)

### Task 1.3: Orchestrator Agent — Pre-Recon Phase

**Time estimate context:** Core intelligence. Drives everything downstream.

> **📖 Documentation sources:**
> - **`@mastra/mcp-docs-server`** → Query for: `Agent` class constructor, `createTool()`, `instructions` parameter, model routing
> - **`@mastra/mcp-docs-server`** → Query for: `AgentNetwork` if using multi-agent orchestration
>
> **Mastra agent pattern:**
> ```typescript
> import { Agent } from "@mastra/core/agent";
> const orchestrator = new Agent({
>   name: "dispatch-orchestrator",
>   instructions: "You are a security orchestrator...",
>   model: "openrouter/anthropic/claude-opus-4",
>   tools: { preReconTool, attackMatrixTool, dispatchTool },
> });
> ```

- [ ] Build orchestrator agent in Mastra (`src/orchestrator/agent.ts`)
- [ ] Implement pre-recon phase (`src/orchestrator/pre-recon.ts`):
  - Read codebase respecting `.dispatchignore`
  - Read `RULES.md`
  - Produce pre-recon deliverable JSON matching Schema 0 in `communication-schemas.md`:
    - `route_map`: endpoints, handler files/lines, middleware chains, parameters
    - `risk_signals`: raw SQL, missing auth, hardcoded secrets, eval/exec
    - `dependency_graph`: DB layer, ORM, auth middleware, session store
    - `briefing_notes`: freeform strategic observations
- [ ] Test: run pre-recon against sample app, verify route map finds all 5 routes, risk signals flag SQL injection in orders.js and missing auth on admin route

**Impacted files:**
- `src/orchestrator/agent.ts` (new)
- `src/orchestrator/pre-recon.ts` (new)
- `src/orchestrator/types.ts` (new — PreReconDeliverable, RouteMapEntry, RiskSignal)
- `src/schemas/pre-recon-deliverable.ts` (new — JSON schema validation)

### Task 1.4: Orchestrator Agent — Attack Matrix + Worker Dispatch

**Time estimate context:** Depends on pre-recon. Connects orchestrator to Blaxel.

> **📖 Documentation sources:**
> - **Context7** → `resolve-library-id: blaxel` for Blaxel SDK (`SandboxInstance`, `fs`, `process`)
> - **`@mastra/mcp-docs-server`** → Query for: `MCPClient` to consume Blaxel sandbox MCP endpoints
>
> **Blaxel SDK pattern:**
> ```typescript
> import { SandboxInstance } from "@blaxel/core";
> const sandbox = await SandboxInstance.createIfNotExists({
>   name: `pentester-${workerId}`,
>   ports: [{ name: "app", port: 3000, protocol: "HTTP" }],
>   ttl: 3600,
> });
> await sandbox.fs.write("/dispatch/task-assignment.json", JSON.stringify(task));
> await sandbox.process.exec({ command: "pnpm install", workingDir: "/app" });
> ```

- [ ] Implement attack matrix builder (`src/orchestrator/attack-matrix.ts`):
  - Takes pre-recon deliverable as input
  - Builds (endpoint x attack_type) matrix
  - Filters to high-risk cells only (informed by risk_signals)
  - Produces list of task assignments (Schema 1 from `communication-schemas.md`)
- [ ] Implement Blaxel dispatcher (`src/orchestrator/dispatcher.ts`):
  - Connects to Blaxel via `@blaxel/core` TypeScript SDK (v0.2.66)
  - Uses `@blaxel/mastra` (v0.2.43) for `blModel()` + `blTools()` integration
  - Creates sandbox per pentester worker with:
    - Repo cloned
    - Env vars from `app_config`
    - Task assignment JSON at `/dispatch/task-assignment.json`
  - Can use sandbox MCP (`<sandbox-url>/mcp`) for tool-call-based communication
  - Monitors sandbox status (poll for completion)
  - Retrieves finding report JSON from `/dispatch/finding-report.json` via `sandbox.fs.read()`
  - Handles timeouts and error classification
- [ ] Implement result collector (`src/orchestrator/collector.ts`):
  - Merges finding reports from all workers
  - Deduplicates findings by deterministic key: `hash(endpoint, parameter, vuln_type)` — ensures two workers testing the same endpoint produce matching IDs
  - Ranks by severity (CRITICAL → HIGH → MEDIUM → LOW)
  - Handles worker errors by type (retry retryable, alert non-retryable)
- [ ] Test: dispatch 2 workers against sample app, collect results

**Impacted files:**
- `src/orchestrator/attack-matrix.ts` (new)
- `src/orchestrator/dispatcher.ts` (new)
- `src/orchestrator/collector.ts` (new)
- `src/schemas/task-assignment.ts` (new — Schema 1 validation)
- `src/schemas/finding-report.ts` (new — Schema 2 validation)

### Task 1.5: Pentester Worker Agent

**Time estimate context:** The core testing engine. Depends on middleware + task assignment schema.

> **📖 Documentation sources:**
> - **`@mastra/mcp-docs-server`** → Query for: `createTool()` with Zod schemas, tool `execute` function
> - **Context7** → `resolve-library-id: express` for understanding target app patterns
> - Internal ref: `agent-documentation-bundles.md` Section 2 (pentester bundle)

- [ ] Build pentester worker agent (`src/workers/pentester/agent.ts`):
  - Reads task assignment from `/dispatch/task-assignment.json`
  - Runs setup sequence:
    1. Run `app_config.install`
    2. Run `app_config.seed` (if present) — this also generates the test auth token
    3. Start app with middleware injection: `node -r ./dispatch-preload.js app.js` (replaces `app_config.start`)
    4. Wait for `app_config.port` to accept connections (poll with HTTP GET, 500ms intervals, 30s timeout)
    5. Read auth token from `context.api_keys.auth_token` (provided by orchestrator, sourced from seed output)
- [ ] Implement Phase A — Attack (`src/workers/pentester/attack.ts`):
  - Read assigned code context (target file, relevant files)
  - Generate attack payloads based on `attack_type`
  - Send payloads to target endpoint (with `X-Dispatch-Worker-Id` header)
  - Query `/_dispatch/logs` after each payload for server-side evidence
  - Build vulnerability queue (list of confirmed/unconfirmed findings)
- [ ] Implement Phase B — Monkeypatch (`src/workers/pentester/monkeypatch.ts`):
  - Gate: skip if vulnerability queue is empty
  - For each finding:
    1. Apply monkeypatch to code
    2. Restart app
    3. Re-send attack payload
    4. Query logs, check if exploit still works
    5. Record `validated` or `failed`
    6. `git checkout -- .` to restore clean state
- [ ] Implement report builder (`src/workers/pentester/report.ts`):
  - Produces finding report JSON matching Schema 2 in `communication-schemas.md`
  - Includes `exploit_confidence` (confirmed/unconfirmed) per finding
  - Includes `clean_endpoints` for tested-and-safe parameters
  - Writes to `/dispatch/finding-report.json`
- [ ] Implement error handling matching the error classification model:
  - `app_start_failed`, `app_crash`, `network_error`, `auth_failed`, `config_error`, `worker_error`, `timeout`
  - Structured `error_detail` object with type, code, message, retryable, phase, suggestion

**Impacted files:**
- `src/workers/pentester/agent.ts` (new)
- `src/workers/pentester/attack.ts` (new)
- `src/workers/pentester/monkeypatch.ts` (new)
- `src/workers/pentester/report.ts` (new)
- `src/workers/pentester/setup.ts` (new — app startup sequence)
- `src/workers/pentester/types.ts` (new — VulnQueueEntry, AttackResult)

### Task 1.6: GitHub Issue Creator + Tagging System

**Time estimate context:** Can be built in parallel with pentester workers once schemas are defined.

> **📖 Documentation sources:**
> - **Context7** → `resolve-library-id: octokit` for GitHub REST API client patterns
> - Internal ref: `github-issue-schema.md` for issue format + tagging system
> - Internal ref: `agent-documentation-bundles.md` Section 1.2 for GitHub Issues API endpoints
>
> **🔌 Runtime MCP — GitHub MCP Server (official):**
> Use `github/github-mcp-server` instead of raw HTTP calls. It provides:
> - `create_issue` — create issue with title, body, labels in one call
> - `add_labels_to_issue` — apply all 5 tag axes
> - `create_label` — bootstrap Dispatch label set with color coding
> - `list_labels` — check which labels already exist (idempotent setup)
>
> **MCP config for GitHub:**
> ```json
> {
>   "github": {
>     "command": "docker",
>     "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
>     "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<pat>" }
>   }
> }
> ```
> Use `--toolsets issues,labels` flag to reduce context noise (only load issue/label tools).

- [ ] Implement label bootstrapper (`src/github/labels.ts`):
  - Creates all Dispatch labels on first run if they don't exist
  - Color coding per `agent-documentation-bundles.md`:
    - `exploit:confirmed` → green, `exploit:unconfirmed` → yellow
    - `monkeypatch:validated` → green, `monkeypatch:failed` → red, `monkeypatch:not-attempted` → gray
    - `fix:unfixed` → red, `fix:in-progress` → blue, `fix:verified` → green, `fix:unverified` → orange, `fix:failed` → dark red
    - `severity:critical` → dark red, `severity:high` → red, `severity:medium` → orange, `severity:low` → yellow
- [ ] Implement issue creator (`src/github/issues.ts`):
  - Takes a finding from the merged report
  - Formats issue body as markdown matching `github-issue-schema.md`
  - Creates issue via **GitHub MCP** `create_issue` tool (or Octokit REST fallback)
  - Applies all 5 tag axes as labels via **GitHub MCP** `add_labels_to_issue`
  - Returns issue URL and number
- [ ] Test: create an issue from a sample finding, verify title format, body structure, and all labels applied

**Impacted files:**
- `src/github/labels.ts` (new)
- `src/github/issues.ts` (new)
- `src/github/types.ts` (new)
- `src/github/client.ts` (new — GitHub API wrapper with auth)

### Task 1.7: Dashboard (React)

**Time estimate context:** Can be built in parallel once finding report schema is known.

- [ ] Scaffold React app (`src/dashboard/`)
- [ ] Build findings list view:
  - Table of all findings sorted by severity
  - Color-coded severity badges (CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=gray)
  - Columns: severity, vuln type, endpoint, file:line, exploit confidence, monkeypatch status, fix status
  - Click row to expand finding detail
- [ ] Build finding detail view:
  - Full description
  - Reproduction steps (with copy button for curl command)
  - Server logs (from Dispatch middleware — field: `server_logs`)
  - Monkeypatch diff (syntax highlighted)
  - Recommended fix
  - Link to GitHub Issue
- [ ] Build scan summary header:
  - Total findings count by severity
  - Endpoints tested / clean / vulnerable
  - Scan duration
  - Worker count and status
- [ ] Wire to orchestrator output: dashboard reads `dispatch-output.json` from disk, polls every 2 seconds via Vite dev server static file serving
- [ ] Test: load sample finding data, verify renders correctly

**Impacted files:**
- `src/dashboard/` (new directory)
- `src/dashboard/App.tsx`
- `src/dashboard/components/FindingsList.tsx`
- `src/dashboard/components/FindingDetail.tsx`
- `src/dashboard/components/ScanSummary.tsx`
- `src/dashboard/types.ts`

### Task 1.8: End-to-End Integration Test

- [ ] Run full pipeline: trigger scan → orchestrator pre-recon → dispatch 2 workers → collect findings → create issues → display on dashboard
- [ ] Verify:
  - Pre-recon identifies all 5 routes and risk signals
  - At least 2 pentester workers spin up on Blaxel
  - Workers find SQL injection on `/api/orders` and missing auth on `/api/admin/users`
  - Finding reports include `exploit_confidence: confirmed` with reproduction steps
  - GitHub Issues created with correct title format, body, and all tags
  - Dashboard shows findings with correct severity ordering

**Phase 1 Done Criteria:**
- Orchestrator successfully reads sample app, identifies vulnerabilities, dispatches workers
- At least 2 findings with `exploit:confirmed` status
- GitHub Issues created with all 5 tag axes applied
- Dashboard renders findings with severity-coded list and detail views
- End-to-end flow completes without manual intervention

---

## Phase 2: Scaling / Refining (Saturday 12 PM → Saturday 8:30 PM)

**Goal:** Construction worker opens PRs. PDF report. RAG Q&A. Polish demo flow.

### Task 2.1: Construction Worker Agent

> **📖 Documentation sources:**
> - **`@mastra/mcp-docs-server`** → Query for: agent tool definitions, workflow steps
> - **Context7** → `resolve-library-id: octokit` for GitHub Issues read + PR create API
> - Internal ref: `agent-documentation-bundles.md` Section 3 (construction worker bundle)
> - Internal ref: `agent-documentation-bundles.md` Section 3.1 for `exploit_confidence` × `monkeypatch_status` strategy matrix
>
> **🔌 Runtime MCPs:**
> - **GitHub MCP** → `get_issue` to fetch finding details, `update_issue` to relabel, `create_pull_request` to open fix PR

- [ ] Build construction worker agent (`src/workers/constructor/agent.ts`):
  - Reads bootstrap payload (Schema 3 from `communication-schemas.md`)
  - Fetches GitHub Issue via **GitHub MCP** `get_issue` tool
  - Parses structured metadata, monkeypatch diff, reproduction command, recommended fix
  - Updates issue label via **GitHub MCP**: `fix:unfixed` → `fix:in-progress`
- [ ] Implement fix engine (`src/workers/constructor/fix.ts`):
  - Strategy selection based on `exploit_confidence` x `monkeypatch_status` matrix (see `agent-documentation-bundles.md` Section 3.1)
  - Write production-quality fix following codebase conventions
  - Start app, run reproduction command, validate fix
- [ ] Implement PR creator (`src/workers/constructor/pr.ts`):
  - Create branch: `dispatch/fix-{vuln_type}-{endpoint}-{issue_number}`
  - Commit fix
  - Push branch
  - Open PR via **GitHub MCP** `create_pull_request` with body matching template in `agent-documentation-bundles.md` Section 3.2
  - Include `Fixes #{issue_number}` for auto-close
- [ ] Implement fix report (`src/workers/constructor/report.ts`):
  - Post fix report as issue comment via **GitHub MCP** (markdown format from Schema 4)
  - Emit JSON payload for dashboard/Slack
  - Update issue label via **GitHub MCP** to `fix:verified`, `fix:unverified`, or `fix:failed`
- [ ] Test: trigger construction worker on a SQL injection issue, verify PR opened with valid fix

**Impacted files:**
- `src/workers/constructor/agent.ts` (new)
- `src/workers/constructor/fix.ts` (new)
- `src/workers/constructor/pr.ts` (new)
- `src/workers/constructor/report.ts` (new)
- `src/workers/constructor/types.ts` (new)

### Task 2.2: PDF Report Generator

- [ ] Build report generator (`src/reporting/pdf.ts`):
  - Executive Summary (1 page): total findings, severity breakdown, risk score, endpoints tested
  - Critical Findings: full detail with code locations, reproduction steps, remediation
  - High Findings: same format
  - Medium/Low Findings: condensed format
  - GitHub permalinks and issue links for each finding
- [ ] Use a PDF library (pdfkit, puppeteer, or react-pdf)
- [ ] Test: generate PDF from sample scan results, verify severity ordering and no empty pages

**Impacted files:**
- `src/reporting/pdf.ts` (new)
- `src/reporting/templates/` (new — report section templates)

### Task 2.3: RAG Q&A System

> **📖 Documentation sources:**
> - **`@mastra/mcp-docs-server`** → Query for: Mastra RAG/memory system, vector storage, embedding

- [ ] After scan completion, index all findings into a RAG system:
  - Chunk by finding (one doc per finding)
  - Include: description, reproduction steps, code location, recommended fix, severity
  - Include: clean endpoints (what was tested and found safe)
- [ ] Build Q&A endpoint or CLI interface:
  - Developer asks natural language questions
  - RAG retrieves relevant findings
  - LLM generates contextual answer with code references
- [ ] Test with sample questions:
  - "What's the most critical finding?"
  - "Are any payment endpoints vulnerable?"
  - "Explain the SQL injection you found"

**Impacted files:**
- `src/rag/indexer.ts` (new)
- `src/rag/query.ts` (new)
- `src/rag/types.ts` (new)

### Task 2.4: Dashboard Polish + Fix Button

- [ ] Add "Fix" button to finding detail view → triggers construction worker
- [ ] Add fix status indicator (updates when construction worker completes)
- [ ] Add scan progress view (shows worker status during active scan)
- [ ] Add PDF download button

**Impacted files:**
- `src/dashboard/components/FindingDetail.tsx` (edit)
- `src/dashboard/components/ScanProgress.tsx` (new)
- `src/dashboard/components/FixButton.tsx` (new)

**Phase 2 Done Criteria:**
- Construction worker reads GitHub Issue, writes fix, opens PR with validation
- PDF report generates with severity-organized sections and GitHub links
- RAG Q&A answers developer questions with finding references
- Dashboard has Fix button that triggers construction worker
- Demo flow is smooth: scan → findings → fix → PR → verified

---

## Phase 3: Optimization / Nice-to-Have (Saturday 8:30 PM → Sunday 9:10 AM)

**Goal:** Polish for demo. Add stretch features if time allows. Record video. Build pitch.

### Task 3.1: Slack Bot (if time)

> **📖 Documentation sources:**
> - **Context7** → `resolve-library-id: slack-bolt` for `@slack/bolt` (Node.js — Socket Mode, Events API)
> - Internal ref: `agent-documentation-bundles.md` Section 1.3 for message templates

- [ ] Set up Slack app with `@slack/bolt` (Node.js, Socket Mode)
- [ ] Listen for `@Dispatch scan {repo}` and `@Dispatch fix issue #{n}`
- [ ] Post scan progress and results to Slack thread (via **Slack MCP** `slack_reply_to_thread` or WebClient)
- [ ] Post fix status when construction worker completes

**Impacted files:**
- `src/integrations/slack/bot.ts` (new)
- `src/integrations/slack/handlers.ts` (new)
- `src/integrations/slack/templates.ts` (new — Block Kit message templates)

### Task 3.2: Datadog Forwarding (if time)

> **Phase 3 stretch — only attempt if Phase 2 is complete.**

- [ ] Add Datadog forwarding to the log middleware (if `DATADOG_API_KEY` env var present)
- [ ] Forward tagged logs to Datadog with `dispatch_run_id` and `dispatch_worker_id` tags
- [ ] Orchestrator queries Datadog via **Datadog MCP** for dashboard enrichment after scan

**Impacted files:**
- `src/middleware/dispatch-log-middleware.ts` (edit — add Datadog forwarding)
- `src/integrations/datadog/client.ts` (new)

### Task 3.3: Monkeypatch Validation Loop (if time)

- [ ] After construction worker opens PR, optionally re-run the pentester worker against the fixed code
- [ ] If re-test passes, mark fix as `fix:verified` with re-test evidence
- [ ] If re-test fails, mark as `fix:unverified` and add re-test notes to issue

### Task 3.4: Demo Prep (MUST DO — Sunday morning)

- [ ] Record 3-minute demo video following script in `proj-description.md`:
  1. Show repo with `RULES.md`
  2. Trigger scan
  3. Show orchestrator planning output
  4. Show workers deploying and findings streaming
  5. Show GitHub Issues with tags
  6. Show construction worker opening PR
  7. Show RAG Q&A
- [ ] Build MakePortals demo page
- [ ] Finalize pitch deck
- [ ] Submit via Airtable before 9:10 AM

**Phase 3 Done Criteria:**
- Demo video recorded and submitted
- Pitch deck finalized
- (Stretch) Slack bot responds to scan/fix commands
- (Stretch) Datadog logs forwarded and queryable

---

## Risk Assessment

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Blaxel SDK issues or account setup delays | **High** — blocks all worker execution | Build worker agent to run locally first (no sandboxing), then add Blaxel wrapper. If Blaxel is down, demo with local workers. |
| LLM hallucination in pre-recon (wrong routes, phantom files) | **High** — bad attack matrix = wasted workers | Use a simple, well-structured sample app. Validate pre-recon deliverable against actual file system before proceeding. |
| Pentester worker can't exploit the deliberately vulnerable app | **High** — no findings = no demo | Pre-test payloads manually. Have fallback "golden" finding reports to inject if worker struggles. |
| Mastra orchestration complexity in 36 hours | **Medium** — could slow Phase 1 significantly | Start with simplest possible Mastra setup (1 orchestrator, 2 tools). Add complexity only as needed. If stuck, bypass Mastra and use direct LLM API calls. |
| Middleware injection fails for non-Express apps | **Low** — only affects future, not hackathon | Sample app is Express. Only support Express middleware injection for MVP. |
| GitHub API rate limiting during demo | **Low** — 5000 requests/hour is generous | Cache label creation. Batch issue creation. Won't hit limits with 5-10 findings. |
| OpenRouter API downtime or rate limits | **Medium** — blocks all LLM reasoning | Have Anthropic API key as direct fallback. Pre-cache orchestrator pre-recon output so demo can continue from cached results. |
| Monkeypatch validation breaks the app (can't restart) | **Medium** — pentester gets stuck | Implement strict `git checkout -- .` reset before each monkeypatch attempt. Add timeout per monkeypatch cycle (60s max). If app won't restart, skip Phase B and report findings without monkeypatch validation. |
| Dashboard doesn't render in time for demo | **Medium** — weakens visual impact | Build static JSON → HTML renderer as fallback. A simple findings.html with severity colors is better than no dashboard. |
| Construction worker writes bad fix / breaks the app | **Low** — for demo, we control the vuln | Pre-test the fix path for SQL injection (parameterized query) manually. If worker struggles, have a fallback branch with the fix pre-committed. |

---

## Suggested Tests

Tests the building agent should write to validate implementation correctness.

### Sample App Tests
- `sample-app/test/routes.test.ts` — verify all 5 routes exist and respond
- `sample-app/test/vulns.test.ts` — verify SQL injection is triggerable on `/api/orders`, verify `/api/admin/users` has no auth check

### Middleware Tests
- `src/middleware/__tests__/dispatch-log-middleware.test.ts`:
  - Test: request with `X-Dispatch-Worker-Id` header → logs captured and queryable
  - Test: request without header → middleware is no-op
  - Test: `GET /_dispatch/logs?worker_id=X` returns only logs for worker X
  - Test: `level=ERROR` filter returns only error logs
  - Test: `since` timestamp filter excludes older logs

### Orchestrator Tests
- `src/orchestrator/__tests__/pre-recon.test.ts`:
  - Test: pre-recon against sample app produces route map with 5 entries
  - Test: risk signals include `raw-sql-concatenation` for orders.js
  - Test: risk signals include `missing-auth-middleware` for admin.js
  - Test: `.dispatchignore` patterns are respected (node_modules excluded)
- `src/orchestrator/__tests__/attack-matrix.test.ts`:
  - Test: matrix only contains cells where risk signals suggest vulnerability
  - Test: SQL injection cell assigned for `/api/orders`, not for `/api/users`
- `src/orchestrator/__tests__/collector.test.ts`:
  - Test: duplicate findings (same `finding_id`) are deduplicated
  - Test: findings sorted by severity (CRITICAL first)
  - Test: retryable errors trigger re-dispatch, non-retryable don't

### Pentester Worker Tests
- `src/workers/pentester/__tests__/attack.test.ts`:
  - Test: SQL injection payload against `/api/orders` returns exploit evidence
  - Test: clean parameter (`quantity`) not flagged as vulnerable
  - Test: logs queried from `/_dispatch/logs` match expected error patterns
- `src/workers/pentester/__tests__/monkeypatch.test.ts`:
  - Test: monkeypatch applied → re-attack fails → status = `validated`
  - Test: bad monkeypatch → re-attack succeeds → status = `failed`
  - Test: git state restored after each monkeypatch attempt
- `src/workers/pentester/__tests__/report.test.ts`:
  - Test: finding report JSON validates against Schema 2
  - Test: `exploit_confidence` is `confirmed` when reproduction succeeds
  - Test: `exploit_confidence` is `unconfirmed` when code pattern spotted but not triggered

### GitHub Integration Tests
- `src/github/__tests__/labels.test.ts`:
  - Test: all Dispatch labels created with correct colors
  - Test: idempotent — running twice doesn't create duplicates
- `src/github/__tests__/issues.test.ts`:
  - Test: issue title matches `[{SEVERITY}] {VULN_TYPE}: {ENDPOINT} — {DESC}` format
  - Test: issue body contains all required sections (metadata, vulnerability, reproduction, monkeypatch, recommended fix)
  - Test: all 5 tag axes applied as labels
  - Test: `exploit:unconfirmed` finding creates issue with `exploit:unconfirmed` label

### Construction Worker Tests
- `src/workers/constructor/__tests__/fix.test.ts`:
  - Test: parses GitHub Issue body correctly (metadata, monkeypatch diff, reproduction command)
  - Test: `confirmed + validated` strategy uses monkeypatch as base for production fix
  - Test: `unconfirmed + not-attempted` strategy flags PR as `fix:unverified`
- `src/workers/constructor/__tests__/pr.test.ts`:
  - Test: branch name follows `dispatch/fix-{vuln_type}-{endpoint}-{issue}` pattern
  - Test: PR body includes `Fixes #{issue_number}`
  - Test: PR title follows `[Dispatch] Fix {vuln_type} in {METHOD} {endpoint}` format

### End-to-End Tests
- `test/e2e/full-pipeline.test.ts`:
  - Test: scan → pre-recon → dispatch → collect → issues created → dashboard populated
  - Test: at least 1 finding with `exploit:confirmed` and `monkeypatch:validated`
  - Test: construction worker reads issue, opens PR, validation passes

---

## Implementation Schedule (Mapped to 36-Hour Timeline)

| Block | Time | Tasks | Priority |
|---|---|---|---|
| **Friday Night** | 6:00–6:30 PM | Environment setup: API keys (Blaxel, OpenRouter, GitHub PAT), MCP config, `.env` file | Must |
| | 6:30–8:00 PM | Task 1.1: Project scaffold + sample app + seed + auth token | Must |
| | 8:00–9:00 PM | Task 1.2: Dispatch log middleware + preload injection script | Must |
| | 9:00–10:00 PM | Task 1.3: Orchestrator pre-recon | Must |
| **Saturday Morning** | 9:00–10:30 AM | Task 1.4: Attack matrix + Blaxel dispatcher | Must |
| | 10:30 AM–2:30 PM | Task 1.5: Pentester worker agent (4 hours — this is the core product) | Must |
| **Saturday Afternoon** | 2:30–3:30 PM | Task 1.6: GitHub Issue creator + tagging (via GitHub MCP) | Must |
| | 3:30–4:30 PM | Task 1.7: Dashboard (React, reads `dispatch-output.json`) | Must |
| | 4:30–5:00 PM | `src/cli.ts` scan entry point + Task 1.8: End-to-end integration | Must |
| | 5:00–6:00 PM | Task 2.1: Construction worker (simplified — just open PR, skip validation) | Should |
| **Saturday Evening** | 6:00 PM | **Attend pitch workshop** | Must |
| | 7:00–8:00 PM | Task 2.2: PDF report OR Task 2.3: RAG Q&A (pick one) | Should |
| | 8:00–8:30 PM | Task 2.4: Dashboard polish | Should |
| **Sunday Morning** | Before 9:10 AM | Task 3.4: Demo video, pitch deck, submit | Must |

**Cut order if behind schedule:**
1. Drop RAG Q&A (Task 2.3) — pick PDF report instead (more visual for demo)
2. Drop PDF report (Task 2.2) — show findings on dashboard instead
3. Drop construction worker entirely (Task 2.1) — demo the scan → findings → issues flow
4. Never cut: sample app, middleware, orchestrator, pentester worker, GitHub issues, dashboard, CLI entry point, demo prep

---

## File Manifest

### New Files (Phase 1)
| File | Purpose |
|---|---|
| `.env.example` | Template for required env vars: `BL_API_KEY`, `OPENROUTER_API_KEY`, `GITHUB_TOKEN`, `JWT_SECRET` |
| `src/cli.ts` | Scan entry point: `pnpm tsx src/cli.ts scan <path>` — invokes orchestrator, writes `dispatch-output.json` |
| `sample-app/` | Deliberately vulnerable Express app (8-10 files) |
| `src/middleware/dispatch-log-middleware.ts` | Log capture middleware |
| `src/middleware/dispatch-preload.js` | `-r` preload script — patches Express require to auto-inject middleware |
| `src/orchestrator/agent.ts` | Orchestrator Mastra agent |
| `src/orchestrator/pre-recon.ts` | Pre-recon code analysis |
| `src/orchestrator/attack-matrix.ts` | Attack matrix builder |
| `src/orchestrator/dispatcher.ts` | Blaxel container management |
| `src/orchestrator/collector.ts` | Finding report merger |
| `src/workers/pentester/agent.ts` | Pentester worker agent |
| `src/workers/pentester/attack.ts` | Attack phase logic |
| `src/workers/pentester/monkeypatch.ts` | Monkeypatch validation |
| `src/workers/pentester/report.ts` | Finding report builder |
| `src/github/labels.ts` | Label bootstrapper |
| `src/github/issues.ts` | Issue creator |
| `src/github/client.ts` | GitHub API wrapper |
| `src/schemas/*.ts` | JSON schema validation for all schemas |
| `src/dashboard/` | React dashboard (5-6 component files) |

### New Files (Phase 2)
| File | Purpose |
|---|---|
| `src/workers/constructor/agent.ts` | Construction worker agent |
| `src/workers/constructor/fix.ts` | Fix engine |
| `src/workers/constructor/pr.ts` | PR creator |
| `src/reporting/pdf.ts` | PDF report generator |
| `src/rag/indexer.ts` | Finding indexer for RAG |
| `src/rag/query.ts` | Q&A query engine |

### Existing Files (Reference Only — Do Not Modify)
| File | Purpose |
|---|---|
| `docs/proj-description.md` | Project description and demo script |
| `docs/github-issue-schema.md` | Issue format + tagging system |
| `docs/communication-schemas.md` | All JSON schemas + flow diagrams |
| `docs/agent-documentation-bundles.md` | Per-agent doc bundles |
| `docs/shannon-research.md` | Shannon research notes |
| `docs/mcp-and-documentation-strategy.md` | Full MCP & documentation strategy (generated 2026-03-14) |

---

## MCP Quick Reference

### Build-Time MCPs (for Claude Code)

| MCP | Package | Install | Purpose |
|---|---|---|---|
| **Mastra Docs** | `@mastra/mcp-docs-server` v1.1.10 | `npx -y @mastra/mcp-docs-server` | Full Mastra API reference, types, examples |
| **Context7** | `@upstash/context7-mcp` | `npx -y @upstash/context7-mcp@latest` | Live docs for Express, Octokit, Slack Bolt, Blaxel |

### Runtime MCP (for Dispatch agents — Phase 1-2)

| MCP | Package / Endpoint | Key Tools | Used In |
|---|---|---|---|
| **GitHub** (official) | `github/github-mcp-server` (Docker) | `create_issue`, `add_labels_to_issue`, `create_pull_request`, `get_issue` | Tasks 1.6, 2.1 |

### Stretch MCPs (Phase 3 only — do not configure until Phase 2 is complete)

| MCP | Package | Used In |
|---|---|---|
| **Slack** | `@modelcontextprotocol/server-slack` | Task 3.1 |
| **Linear** | `mcp.linear.app/mcp` (remote) | Task 3.1+ |
| **Datadog** | Official remote MCP | Task 3.2 |
| **Sentry** | `mcp.sentry.io` (remote) | Task 3.2+ |

### Key Package Versions

| Package | Version |
|---|---|
| `@mastra/core` | 1.10.0 |
| `@mastra/mcp-docs-server` | 1.1.10 |
| `@blaxel/core` | 0.2.66 |
| `@blaxel/mastra` | 0.2.43 |
| `@openrouter/ai-sdk-provider` | latest (optional — string notation works built-in) |

---

> **COMMIT PROTOCOL — When implementation is complete, launch a `commit-architect` sub-agent instance (via the Task tool with `subagent_type="commit-architect"`) to analyze your changes and produce clean, atomic Conventional Commits. Do not write commits manually.**

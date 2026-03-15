# Dispatch — App Rundown

**Dispatch** is an agent-driven security pentesting platform. It scans web applications for vulnerabilities, creates issues in GitHub/Linear, and can auto-fix findings via AI-powered PRs. You can run scans via CLI, Slack, or API.

---

## What It Does

1. **Scans** a target app (Flask, Node, etc.) for security vulnerabilities (SQLi, XSS, IDOR, auth issues, etc.)
2. **Reports** findings with severity, evidence, and remediation hints
3. **Integrates** with GitHub (issues) and Linear (tickets)
4. **Fixes** issues via the Constructor worker — parses GitHub/Linear issues and opens fix PRs
5. **Surfaces** results in Slack, a live graph dashboard, and PDF reports

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Entry Points                                                            │
│  CLI (scan) │ Slack (@Dispatch) │ API (POST /api/fix)                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Orchestrator                                                             │
│  Pre-Recon → Attack Matrix → Dispatch Workers → Merge Reports → Output    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  Pentester Worker     │  │  Constructor Worker   │  │  Memory Layer         │
│  (vuln detection)    │  │  (fix PRs from issues) │  │  (cross-run history)  │
│  local / claude /     │  │  Blaxel sandbox       │  │  SQLite (planned)     │
│  blaxel               │  │                       │  │                       │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

---

## Scan Pipeline

| Phase | What Happens |
|-------|--------------|
| **Pre-Recon** | Static analysis: finds routes, risk signals (SQL, auth, injection patterns), dependency graph. Optional hybrid mode augments with Claude. |
| **Attack Matrix** | Maps routes × attack types (sql-injection, xss, idor, etc.) into task cells, filtered by risk. |
| **Task Assignments** | Each cell becomes a `TaskAssignment` (endpoint, attack type, app config, auth token). |
| **Dispatch Workers** | Runs pentester workers (local subprocess, Claude agent, or Blaxel). Each worker: starts app → attacks → monkeypatches → reports findings. |
| **Merge** | Deduplicates findings by endpoint+parameter+vuln_type, merges into `MergedReport`. |
| **Output** | Writes `dispatch-output.json`, forwards to Datadog, optionally creates GitHub/Linear issues, generates PDF. |

---

## Workers

### Pentester Worker

- **Input:** `TaskAssignment` (endpoint, attack type, app config)
- **Flow:** Start target app → run Claude-powered attack phase → optional monkeypatch validation → build `FindingReport`
- **Modes:** `local` (subprocess), `claude` (Claude Code agent), `blaxel` (Blaxel sandbox)
- **Output:** JSON report with findings (severity, evidence, location)

### Constructor Worker

- **Input:** GitHub issue or Linear issue (security finding)
- **Flow:** Fetch issue → parse (endpoint, vuln type, evidence) → apply fix via Claude → open PR → optionally retest
- **Triggered by:** API `POST /api/fix` or `GET /fix?linear=DISP-123&github_repo=owner/repo`
- **Output:** Fix PR, status (fix_verified, fix_unverified, etc.)

---

## Middleware Layer & Datadog

The **Dispatch log middleware** captures runtime logs from the target app during pentester runs and forwards them to Datadog. It enables the agent to surface `server_logs` and `post_patch_logs` in findings.

### How It Works

1. **Preload injection** — Target apps started with `node -r ./dispatch-preload.js app.js` get the middleware auto-injected. The preload monkeypatches `require('express')` so any new Express app automatically gets `dispatchLogMiddleware()`.
2. **Request-scoped capture** — When a request includes `x-dispatch-worker-id` and `x-dispatch-run-id` headers (sent by the pentester when attacking), the middleware:
   - Captures `console.log`, `console.error`, `console.warn` for that request
   - Logs response status (`METHOD path — statusCode`)
   - Captures response stream errors
3. **Dual storage** — Logs go to an in-memory store (keyed by `worker_id`) and are enqueued for Datadog via `log-forwarder`.
4. **Log query endpoint** — `GET /_dispatch/logs?worker_id=X&run_id=Y` serves logs. If Datadog read is enabled (`DATADOG_API_KEY` + `DD_APP_KEY`), it proxies to Datadog; otherwise it falls back to in-memory.

### Datadog Integration

| Component | Function |
|-----------|----------|
| **Log forwarder** | Batches `DispatchLogEntry` into Datadog log payloads (tags: `dispatch_run_id`, `dispatch_worker_id`, `source`, `env`). Auto-flushes every 5s or when buffer hits 100. |
| **Log reader** | Queries Datadog Logs API for worker logs. Used by `/_dispatch/logs` when `isReadEnabled()`. |
| **Diagnostics forwarder** | Sends worker diagnostics as gauge metrics (wall_clock_seconds, trace_length, tool_calls, errors, etc.). Throttled to 30s per worker. |
| **Loop alerts** | Sends Datadog events when the loop detector flags a worker (repeated calls, consecutive errors). |
| **Collector** | After merge, `forwardToDatadog(mergedReport)` sends scan summary events and metrics (findings by severity). |
| **APM (dd-trace)** | Slack and CLI can initialize `dd-trace` when `DD_AGENT_HOST` is set for distributed tracing. |

### Enabling

- **Write (logs, metrics, events):** `DATADOG_API_KEY`
- **Read (log queries):** `DATADOG_API_KEY` + `DD_APP_KEY`
- **APM:** `DD_AGENT_HOST` (local agent)
- **Site:** `DD_SITE` (default `datadoghq.com`)

---

## Integrations

| Integration | Purpose |
|-------------|---------|
| **Slack** | Socket Mode bot. `@Dispatch scan /path`, `@Dispatch help`, `@Dispatch create issue`. Runs orchestrator and returns findings as Block Kit. |
| **GitHub** | Create issues from findings, open fix PRs. Supports GitHub App for `Dispatch[bot]` identity. |
| **Linear** | Create issues from findings. Constructor can fix Linear tickets via API. |
| **Datadog** | Logs (target app capture), metrics (worker diagnostics, scan summary), events (loop alerts), APM tracing. See [Middleware Layer & Datadog](#middleware-layer--datadog) above. |
| **Sentry** | Error tracking. |

---

## Frontend & Dashboard

- **Next.js** app with a **force-directed graph** of the scan run.
- **Nodes:** Orchestrator, clusters (route × attack), workers, findings.
- **Polls** `frontend/public/dispatch-output.json` (written when output path points there).
- **Findings list** with severity, inspector panel for details.
- **Backend dashboard** (Vite): `pnpm dashboard` — separate dev server for scan summary views.

---

## Memory Layer (Planned)

Cross-run persistence so the orchestrator can say *"this endpoint has been flagged in 4 consecutive scans, bump to Critical"*.

- **Store:** SQLite (`.dispatch/memory.db`)
- **Key:** `target_id` + endpoint + parameter + vuln_type → fingerprint
- **Capabilities:** Record runs, query consecutive counts, escalate severity by recurrence
- **Consumers:** Orchestrator merge phase, Slack recurrence callouts, PR schema enrichment

See `docs/memory-layer-design.md` and `docs/memory-layer-implementation-plan.md`.

---

## Key Commands

```bash
cd backend

pnpm scan ./path/to/target      # Run full scan (local mode)
pnpm scan:sample                # Scan sample-app
pnpm scan:blaxel ../sample-app  # Scan via Blaxel
pnpm report                     # Generate PDF from last run
pnpm slack                      # Start Slack bot
pnpm api                        # Start API server (fix endpoint)
pnpm dashboard                  # Start backend dashboard
pnpm test                       # Run tests
```

---

## Project Structure

```
Dispatch/
├── backend/                    # Node.js/TypeScript
│   ├── src/
│   │   ├── orchestrator/      # Agent, pre-recon, attack-matrix, dispatcher, collector, graph-builder
│   │   ├── workers/
│   │   │   ├── pentester/     # Attack, report, setup, monkeypatch, Claude agent
│   │   │   └── constructor/  # Parse issue, apply fix, PR, report
│   │   ├── slack/            # Bolt app, handlers, client
│   │   ├── github/           # Issues, labels, client
│   │   ├── linear/           # Issues
│   │   ├── memory/           # Fingerprint, config, types (WIP)
│   │   ├── reporting/        # PDF generation
│   │   ├── api/              # Express server (fix endpoint)
│   │   ├── middleware/       # dispatch-log-middleware, dispatch-preload (Express injection)
│   │   ├── integrations/datadog/  # Client, log-forwarder, log-reader, diagnostics-forwarder
│   │   └── diagnostics/     # Poller, loop detector, aggregator
│   └── package.json
├── frontend/                  # Next.js graph + findings UI
├── docs/                      # Design docs, implementation plans
└── sample-app/, dvna-target/, flask-target/  # Test targets
```

---

## Environment

Key vars: `GITHUB_TOKEN`, `GITHUB_REPO`, `LINEAR_TEAM_ID`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `JUICE_SHOP_URL`, `SENTRY_DSN`, `DD_AGENT_HOST`, `DATADOG_API_KEY`, `DD_APP_KEY` (for log read). See `backend/.env.example`.

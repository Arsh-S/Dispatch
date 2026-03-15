# Slack Integration — Wiring Plan

> **Generated:** 2026-03-14  
> **Purpose:** Scan what exists in the Slack folder and what still needs to be wired into the rest of the codebase.

---

## 1. What Exists in `backend/src/slack/`

| File | Purpose |
|------|---------|
| **types.ts** | Slack event types, `SlackConfig`, `AgentConfig`, `AgentProcessingResult`, `Finding`, Block Kit types |
| **client.ts** | Bolt app init, Socket Mode receiver, Block Kit formatters (`formatBlockKitResponse`, `formatErrorResponse`, `formatFindingsResponse`), `extractCommand` |
| **handlers.ts** | `handleAppMention`, `handleDirectMessage`, `processAgentCommand` — routes commands to GitHub/Juice Shop/scan/help |
| **index.ts** | `startSlackAgent()` — observability init, config load/validate, event registration, Socket Mode start |

### Capabilities

- **Socket Mode** — Standalone Slack bot via `@slack/bolt`, no HTTP server required
- **Events:** `app_mention` (when @bot is mentioned), `message` (DMs only)
- **Commands:** `help`, `scan`, `juice`, `create issue` (GitHub)
- **Observability:** Sentry, Datadog tracing (dd-trace)
- **Config:** `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_NOTIFICATION_CHANNEL`, `AGENT_NAME`, `DEBUG`, plus `AgentConfig` (GitHub, Juice Shop, Linear keys)

---

## 2. What Is NOT Wired In

### 2.1 Slack Agent Is Standalone — Not Integrated with Main Flow

| Gap | Current State | Target State |
|-----|---------------|--------------|
| **Entry point** | `pnpm slack` runs `src/slack/index.ts` as a separate process | No integration with CLI, orchestrator, or API |
| **Orchestrator** | CLI `pnpm scan` runs `runOrchestrator` → GitHub issues, PDF, Datadog | Slack never triggers a scan; Slack never receives scan results |
| **Scan trigger** | Slack `scan` command returns **mock findings** | Should call `runOrchestrator` (or equivalent) and return real findings |
| **GitHub issues** | Slack `create issue` returns **mock issue URL** | Should call `createIssuesFromReport` / `createIssueFromFinding` from `backend/src/github/issues.ts` |
| **Linear** | `AgentConfig` has `linearApiKey`, `linearTeamId` but **no handler uses them** | Should create Linear issues from findings (per `linear-demo-integration.md`) |

### 2.2 Slack Handlers Use Placeholders, Not Real Services

| Handler | Current Implementation | Real Integration Needed |
|---------|------------------------|--------------------------|
| `handleSecurityScan` | Returns hardcoded mock findings | Call `runOrchestrator` with a target path (or configurable target) |
| `handleGitHubCommand` | Returns mock issue number/URL | Call `createIssueFromFinding` / `createIssuesFromReport` from `github/issues.ts` |
| `handleJuiceShopCommand` | Echoes URL, no actual scan | Either integrate with Juice Shop API or route to orchestrator if target is Juice Shop |
| **Linear** | No handler at all | Add `handleLinearCommand` or integrate Linear issue creation into scan flow |

### 2.3 No Shared Process / API

| Gap | Detail |
|-----|--------|
| **Separate processes** | `pnpm slack` and `pnpm scan` are independent. Slack agent cannot invoke orchestrator in-process |
| **No HTTP API** | There is no Express server that Slack could call. The backend has `dispatch-log-middleware` and `dispatch-preload` for target apps, but no Dispatch API server |
| **Target path** | Orchestrator needs `targetDir`. Slack has no notion of "which repo to scan" — would need `GITHUB_REPO` or a configured path |

### 2.4 Environment / Config Gaps

| Variable | In Slack Config | In `.env` | Notes |
|----------|-----------------|-----------|-------|
| `SLACK_BOT_TOKEN` | ✓ | ✗ | Required for Slack; not in current `.env` |
| `SLACK_APP_TOKEN` | ✓ | ✗ | Required for Socket Mode |
| `GITHUB_TOKEN` | ✓ | ✓ | Used by CLI for issues; Slack would need same |
| `GITHUB_REPO` | ✓ | ✗ | Slack needs this for `create issue` |
| `LINEAR_API_KEY` | ✓ | ✓ | Present but unused in Slack |
| `LINEAR_TEAM_ID` | ✓ | ✓ | Present but unused in Slack |
| `JUICE_SHOP_URL` | ✓ | ✗ | Optional for Juice Shop commands |

### 2.5 Frontend / Dashboard

- `graphTypes.ts` has `triggered_by: "slack" | "dashboard" | "github" | "api"` — schema supports Slack as a trigger
- No backend path currently sets `triggered_by: "slack"`
- Dashboard does not show Slack-specific UI or "triggered from Slack" runs

### 2.6 Datadog / dd-trace

- `handlers.ts` imports `tracer` from `dd-trace` at top level — if Datadog is not configured, this may still load
- `index.ts` initializes Datadog only when `DD_AGENT_HOST` is set; `handlers` always use `tracer.startSpan`
- Risk: In environments without Datadog, `tracer.startSpan` may throw or no-op depending on dd-trace behavior

---

## 3. Wiring Checklist

### Phase 1: Connect Slack to Real Orchestrator & GitHub

| Task | Description |
|------|-------------|
| **1.1** | Add `scan` command handler that calls `runOrchestrator` with a configured `targetDir` (e.g. from env `DISPATCH_TARGET_DIR` or `GITHUB_REPO` clone path) |
| **1.2** | Replace mock GitHub issue creation in `handleGitHubCommand` with `createIssueFromFinding` from `github/issues.ts` |
| **1.3** | Ensure `GITHUB_REPO` and `GITHUB_TOKEN` are passed through `AgentConfig` and validated when `create issue` is used |
| **1.4** | Add `triggered_by: 'slack'` to orchestrator output / `DispatchOutputWriter` when scan is triggered from Slack |

### Phase 2: Linear Integration

| Task | Description |
|------|-------------|
| **2.1** | Implement Linear issue creation (see `linear-demo-integration.md`) — either in `backend/src/integrations/linear/` or extend Slack handlers |
| **2.2** | Add `create linear issue` or similar command to Slack, or auto-create Linear issues when scan completes (like GitHub in CLI) |
| **2.3** | Use `LINEAR_API_KEY` and `LINEAR_TEAM_ID` from `AgentConfig` |

### Phase 3: Architecture / Process Model

| Task | Description |
|------|-------------|
| **3.1** | Decide: Keep Slack as standalone process, or embed in a unified server (Express + Socket Mode)? |
| **3.2** | If standalone: Ensure `runOrchestrator` can be imported and run from Slack process (same process, different entry point) |
| **3.3** | If unified: Add Express API (e.g. `/api/scan`) and optionally have Slack call it via HTTP, or run orchestrator in-process |

### Phase 4: Observability & Robustness

| Task | Description |
|------|-------------|
| **4.1** | Make dd-trace optional in `handlers.ts` — guard `tracer.startSpan` with a check, or use a no-op tracer when Datadog is disabled |
| **4.2** | Add `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` to `.env.example` and document in README |

### Phase 5: Juice Shop (Optional)

| Task | Description |
|------|-------------|
| **5.1** | Either implement real Juice Shop API calls in `handleJuiceShopCommand`, or map "juice scan" to orchestrator with Juice Shop as target |

---

## 4. Summary Table

| Component | Status | Action |
|-----------|--------|--------|
| Slack Bolt + Socket Mode | ✅ Implemented | None |
| App mention / DM handlers | ✅ Implemented | Wire to real services |
| `processAgentCommand` routing | ✅ Implemented | Replace mock implementations |
| `handleSecurityScan` | ❌ Mock | Call `runOrchestrator` |
| `handleGitHubCommand` | ❌ Mock | Call `createIssueFromFinding` |
| `handleJuiceShopCommand` | ❌ Placeholder | Implement or delegate |
| Linear | ❌ Not implemented | Add handler + integration |
| Orchestrator integration | ❌ Not wired | Import and call from Slack |
| GitHub issues integration | ❌ Not wired | Import and call from Slack |
| `triggered_by: 'slack'` | ❌ Not set | Add to output when Slack-triggered |
| `.env` Slack vars | ❌ Missing | Add `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` |
| dd-trace in handlers | ⚠️ Hard dependency | Make optional |

---

## 5. Recommended Order

1. **Phase 1.1–1.3** — Wire Slack `scan` and `create issue` to real orchestrator and GitHub. Highest impact.
2. **Phase 4.2** — Add env vars so Slack can run.
3. **Phase 2** — Linear integration (if demo flow requires it).
4. **Phase 3** — Decide process model; likely keep standalone for now.
5. **Phase 4.1, 5** — Observability and Juice Shop as needed.

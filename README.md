<p align="center">
  <img src="icons/dispatch-name-logo.png" alt="Dispatch" height="80">
</p>

<p align="center"><strong>Security tools give you a PDF. Dispatch gives you a pull request.</strong></p>

<p align="center"><a href="https://dispatch-eosin.vercel.app/">📽️ View slides</a></p>

---

Dispatch is a multi-agent security testing platform. An orchestrator agent reads your codebase, plans attacks, and dispatches worker agents to test your application for vulnerabilities. Findings flow into GitHub Issues and Linear as actionable tickets. Fixer agents then patch the code and open pull requests — closing the loop from discovery to remediation.

## How it works

```
Codebase + RULES.md
  → Orchestrator reads code, maps routes, plans attacks
    → Pentester workers execute tests against live endpoints
      → Findings ranked by severity with file, line, and reproduction steps
        → Tickets created in GitHub Issues / Linear
          → Fixer workers open PRs with patches
            → Re-test to verify the fix
```

The orchestrator performs whitebox reconnaissance: it reads your source, identifies unprotected routes, finds raw SQL queries, maps auth logic, and builds a targeted attack matrix. Workers run in isolated Blaxel sandboxes (or locally) and report structured findings back. A collector deduplicates, ranks, and compiles everything into a PDF report, an interactive dashboard, and issue tracker tickets.

## What makes Dispatch different

**Code-aware attack planning.** The orchestrator doesn't just fuzz endpoints. It reads your code to understand what's actually happening — which routes lack auth middleware, where queries use string concatenation, which JWT checks are missing signature verification. Attacks are targeted, not generic.

**Closed-loop remediation.** Most security tools stop at "here's what's broken." Dispatch creates the ticket, writes the patch, opens the PR, and re-tests to confirm the fix. The full cycle — find, ticket, fix, verify — runs autonomously.

**Developer workflow integration.** Trigger scans from Slack, the CLI, a dashboard, or an API. Results land where your team already works: GitHub Issues, Linear, Slack threads.

**Configurable via `RULES.md`.** Define your security priorities in plain text. The orchestrator uses these rules to weight findings and customize its attack plan to what matters for your application.

## Quick start

```bash
cd backend
pnpm install
pnpm scan ../sample-app       # scan the bundled vulnerable app
pnpm report                    # generate PDF from results
pnpm dashboard                 # launch the findings dashboard
```

Other entry points:

| Command | Description |
|---|---|
| `pnpm scan <path>` | Run a full scan against a target directory |
| `pnpm scan:blaxel` | Run via Blaxel sandboxes (concurrent workers) |
| `pnpm slack` | Start the Slack bot |
| `pnpm api` | Start the API server |
| `pnpm test` | Run the test suite |

## Environment

```bash
OPENROUTER_API_KEY=...   # LLM routing (required)
GITHUB_TOKEN=...         # Issue creation and PRs
BL_API_KEY=...           # Blaxel sandbox mode (optional)
SLACK_BOT_TOKEN=...      # Slack integration (optional)
SLACK_APP_TOKEN=...      # Slack Socket Mode (optional)
```

## Project structure

```
backend/src/
  cli.ts                  # Entry point
  orchestrator/           # Pre-recon, attack matrix, dispatcher, collector
  workers/pentester/      # Attack + monkeypatch workers
  workers/constructor/    # Fixer workers (issue → PR)
  schemas/                # Zod schemas for agent communication
  github/                 # GitHub Issues + labels (5-axis tagging)
  reporting/              # PDF generation
  dashboard/              # React + Vite findings dashboard
  api/                    # API server
  slack/                  # Slack bot
  memory/                 # Finding fingerprinting + escalation tracking

sample-app/               # Deliberately vulnerable Express app for testing
frontend/                 # Next.js frontend
```

## Architecture

The system uses three communication schemas passed between agents as structured JSON (validated with Zod):

| Schema | Carries |
|---|---|
| Pre-Recon Deliverable | Codebase map, route inventory, auth gaps, attack surface |
| Task Assignment | Target endpoint, attack type, worker config |
| Finding Report | Severity, evidence, file/line, reproduction steps, suggested fix |

Workers run sequentially in local mode (with 2s delays for port release) or concurrently in Blaxel sandboxes with configurable max concurrency. Findings are deduplicated by fingerprint and ranked using a weighted risk score (Critical x10, High x5, Medium x2, Low x1) normalized against total endpoints.

## Contributors

Arsh Singh, Mateo del Rio Lanse, Jimmy Mulosmani, Diya Sheth

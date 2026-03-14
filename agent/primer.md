# Dispatch — Agent Primer

> **Generated:** 2026-03-14_15-30-30

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.9.3 |
| Runtime | Node.js (via tsx) | — |
| Package Manager | pnpm | 10.32.1 |
| Sandbox Runtime | Blaxel (`@blaxel/core`) | 0.2.74 |
| LLM Router | OpenRouter (Claude Opus 4.6, Sonnet 4.6, Haiku 4.5) | — |
| Web Framework | Express.js | 5.2.1 |
| Schema Validation | Zod | 3.25.76 |
| GitHub API | Octokit REST | 22.0.1 |
| PDF Reports | PDFKit | 0.17.2 |
| Dashboard | React + Vite (in `backend/src/dashboard/`) | — |
| Slides | React + Vite (in `slides/`) | — |
| Frontend | Next.js (in `frontend/`) | — |
| Database (sample app) | SQLite via better-sqlite3 | — |
| Testing | Vitest | 4.1.0 |

## Architecture Pattern

**Multi-Agent Orchestrator-Worker** — A central orchestrator agent performs code reconnaissance, builds an attack matrix, then dispatches isolated pentester worker agents (via Blaxel sandboxes or local mode) to test endpoints. Findings are collected, deduplicated, written to GitHub Issues with a 5-axis tagging system, exported as a PDF report, and displayed on a React dashboard. A construction worker agent reads issues and opens fix PRs.

### Data Flow

```
CLI (backend/src/cli.ts)
  → Orchestrator Agent
    → Pre-Recon (reads codebase + RULES.md)
    → Attack Matrix Builder
    → Dispatcher (Blaxel sandboxes or local mode)
      → Pentester Worker Agent (per task)
        → Phase A: Attack (send payloads, collect evidence)
        → Phase B: Monkeypatch (validate fix, restore state)
        → Finding Report JSON
    → Collector (merge, dedup, rank findings)
  → GitHub Issue Creator (with 5-axis labels)
  → PDF Report (via PDFKit)
  → dispatch-output.json
  → Dashboard (React, polls JSON)
  → Construction Worker Agent (reads issue → opens fix PR)
```

### Key Communication Schemas

| Schema | Purpose | Location |
|---|---|---|
| Schema 0 | Pre-Recon Deliverable | `backend/src/schemas/pre-recon-deliverable.ts` |
| Schema 1 | Task Assignment | `backend/src/schemas/task-assignment.ts` |
| Schema 2 | Finding Report | `backend/src/schemas/finding-report.ts` |

## Entry Points

| Command | Script | Description |
|---|---|---|
| `pnpm scan <path>` | `tsx src/cli.ts scan` | Run full security scan pipeline |
| `pnpm scan:sample` | `tsx src/cli.ts scan ./sample-app` | Scan the bundled vulnerable sample app |
| `pnpm scan:blaxel` | `tsx src/cli.ts scan ./sample-app --blaxel` | Scan via Blaxel sandboxes |
| `pnpm report` | `tsx src/cli.ts report` | Generate PDF from existing dispatch-output.json |
| `pnpm dashboard` | `cd src/dashboard && pnpm dev` | Launch React dashboard |
| `pnpm test` | `vitest run` | Run test suite |

## 5 Most Critical Files

| # | File | Role |
|---|---|---|
| 1 | `backend/src/cli.ts` | Application entry point — triggers scan pipeline, GitHub issue creation, PDF report |
| 2 | `backend/src/orchestrator/agent.ts` | Orchestrator — drives pre-recon → attack matrix → dispatch → collect |
| 3 | `backend/src/orchestrator/dispatcher.ts` | Worker dispatch — local sequential or Blaxel sandbox with concurrency control |
| 4 | `backend/src/workers/pentester/agent.ts` | Pentester worker — attack phase, monkeypatch validation, report generation |
| 5 | `backend/src/github/issues.ts` | GitHub Issue creator — 5-axis labels, formatted vulnerability reports |

## Project Structure

```
Dispatch/
├── backend/
│   ├── src/
│   │   ├── cli.ts                    # Scan entry point
│   │   ├── orchestrator/             # Orchestrator agent (pre-recon, attack matrix, dispatcher, collector)
│   │   ├── workers/
│   │   │   ├── pentester/            # Pentester worker (attack, monkeypatch, report, setup, cli)
│   │   │   └── constructor/          # Construction worker (parse issue, fix, PR, report)
│   │   ├── middleware/               # Dispatch log middleware + preload injection
│   │   ├── schemas/                  # Zod schemas for all communication JSON
│   │   ├── github/                   # GitHub Issues/labels integration
│   │   ├── reporting/                # PDF report generation (PDFKit)
│   │   ├── dashboard/                # React+Vite dashboard (separate pnpm package)
│   │   ├── utils/                    # Shared utilities
│   │   └── __tests__/                # Root-level tests
│   ├── package.json
│   └── tsconfig.json
├── sample-app/                       # Deliberately vulnerable Express app (5 routes, SQLite)
├── frontend/                         # Next.js frontend
├── slides/                           # Pitch deck (React+Vite)
├── docs/                             # Design docs, schemas, research
├── agent/                            # Agent plans and primer
└── dispatch-output.json              # Latest scan output
```

## External Dependencies / Services

| Service | Env Var | Purpose |
|---|---|---|
| Blaxel | `BL_API_KEY` | Sandbox isolation for pentester workers |
| OpenRouter | `OPENROUTER_API_KEY` | LLM routing (Claude models) |
| GitHub | `GITHUB_TOKEN` | Issue creation, label management, PRs |
| JWT | `JWT_SECRET` | Auth token for sample app testing |

## Key Design Decisions

- **Local vs Blaxel mode**: Workers run sequentially in local mode (avoids port/lockfile conflicts) or concurrently in Blaxel sandboxes with configurable max concurrency
- **Sequential local workers**: 2-second delay between local workers for port release
- **5-axis GitHub labels**: exploit confidence, monkeypatch status, fix status, classification (severity + vuln type + OWASP), dispatch metadata (run ID + worker ID)
- **PDF tiering**: Critical/High findings get full detail; Medium/Low get condensed one-line entries
- **Risk score formula**: Weighted sum (Critical×10 + High×5 + Medium×2 + Low×1) / total endpoints, capped at 10

# Dispatch — Agent Primer

> **Generated:** 2026-03-14_14-48-17

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.9.3 |
| Runtime | Node.js (via tsx) | — |
| Package Manager | pnpm | 10.32.1 |
| Agent Framework | Mastra (`@mastra/core`) | 1.10.0 |
| Sandbox Runtime | Blaxel (`@blaxel/core` + `@blaxel/mastra`) | 0.2.66 / 0.2.43 |
| LLM Router | OpenRouter (Claude Opus 4.6, Sonnet 4.6, Haiku 4.5) | — |
| Web Framework | Express.js | 5.2.1 |
| Schema Validation | Zod | 3.25.76 |
| GitHub API | Octokit REST | 22.0.1 |
| Dashboard | React + Vite (separate package in `src/dashboard/`) | — |
| Slides | React + Vite (in `slides/`) | — |
| Database (sample app) | SQLite via better-sqlite3 | — |
| Testing | Vitest | 4.1.0 |

## Architecture Pattern

**Multi-Agent Orchestrator-Worker** — A central orchestrator agent performs code reconnaissance, builds an attack matrix, then dispatches isolated pentester worker agents (via Blaxel sandboxes) to test endpoints. Findings are collected, deduplicated, written to GitHub Issues with a 5-axis tagging system, and displayed on a React dashboard. A construction worker agent reads issues and opens fix PRs.

### Data Flow

```
CLI (src/cli.ts)
  → Orchestrator Agent
    → Pre-Recon (reads codebase + RULES.md)
    → Attack Matrix Builder
    → Blaxel Dispatcher (creates sandboxes)
      → Pentester Worker Agent (per sandbox)
        → Phase A: Attack (send payloads, collect evidence)
        → Phase B: Monkeypatch (validate fix, restore state)
        → Finding Report JSON
    → Collector (merge, dedup, rank findings)
  → GitHub Issue Creator (with 5-axis labels)
  → dispatch-output.json
  → Dashboard (React, polls JSON)
  → Construction Worker Agent (reads issue → opens fix PR)
```

### Key Communication Schemas

| Schema | Purpose | Location |
|---|---|---|
| Schema 0 | Pre-Recon Deliverable | `src/schemas/pre-recon-deliverable.ts` |
| Schema 1 | Task Assignment | `src/schemas/task-assignment.ts` |
| Schema 2 | Finding Report | `src/schemas/finding-report.ts` |

## Entry Point

`src/cli.ts` — CLI entry via `pnpm scan <path-to-repo>`. Invokes the orchestrator, writes `dispatch-output.json` on completion.

## 5 Most Critical Files

| # | File | Role |
|---|---|---|
| 1 | `src/cli.ts` | Application entry point — triggers entire scan pipeline |
| 2 | `src/orchestrator/agent.ts` | Orchestrator agent — core intelligence, drives all downstream logic |
| 3 | `src/orchestrator/dispatcher.ts` | Blaxel sandbox management — creates/monitors worker sandboxes |
| 4 | `src/workers/pentester/agent.ts` | Pentester worker — the core testing engine that finds vulnerabilities |
| 5 | `src/github/issues.ts` | GitHub Issue creator — produces tagged vulnerability reports |

## Project Structure

```
dispatch/
├── src/
│   ├── cli.ts                    # Scan entry point
│   ├── orchestrator/             # Orchestrator agent (pre-recon, attack matrix, dispatcher, collector)
│   ├── workers/
│   │   ├── pentester/            # Pentester worker (attack, monkeypatch, report)
│   │   └── constructor/          # Construction worker (parse issue, fix, PR, report)
│   ├── middleware/               # Dispatch log middleware + preload injection
│   ├── schemas/                  # Zod schemas for all communication JSON
│   ├── github/                   # GitHub Issues/labels integration
│   ├── dashboard/                # React+Vite dashboard (separate pnpm package)
│   ├── utils/                    # Shared utilities
│   └── __tests__/                # Root-level tests
├── sample-app/                   # Deliberately vulnerable Express app (5 routes, SQLite)
├── docs/                         # Design docs, schemas, research
├── agent/                        # Agent plans and primer
├── slides/                       # Pitch deck (React+Vite)
└── frontend/                     # Next.js frontend (secondary)
```

## External Dependencies / Services

| Service | Env Var | Purpose |
|---|---|---|
| Blaxel | `BL_API_KEY` | Sandbox isolation for pentester workers |
| OpenRouter | `OPENROUTER_API_KEY` | LLM routing (Claude models) |
| GitHub | `GITHUB_TOKEN` | Issue creation, label management, PRs |
| JWT | `JWT_SECRET` | Auth token for sample app testing |

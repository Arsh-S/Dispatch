---
name: Dispatch Project Architecture
description: Core architecture of the Dispatch security scanner - pipeline stages, file layout, key types, dashboard structure
type: project
---

## Pipeline Flow
CLI (`src/cli.ts`) -> Orchestrator (`src/orchestrator/agent.ts`) -> Pre-Recon -> Attack Matrix -> Dispatcher -> Pentester Workers -> Collector -> dispatch-output.json -> Dashboard / GitHub Issues

## Key File Paths
- Entry point: `src/cli.ts` (pnpm scan / scan:sample)
- Orchestrator: `src/orchestrator/agent.ts` (runOrchestrator)
- Dispatcher: `src/orchestrator/dispatcher.ts` (local vs blaxel mode)
- Collector/Merger: `src/orchestrator/collector.ts` (MergedReport type)
- Schemas: `src/schemas/` (Zod schemas for pre-recon, task-assignment, finding-report)
- Pentester worker: `src/workers/pentester/agent.ts`
- Constructor worker: `src/workers/constructor/agent.ts` (takes ConstructorBootstrap, returns FixResult)
- Dashboard: `src/dashboard/` (separate Vite+React19 project, own package.json)
- Dashboard components: `src/dashboard/src/components/` (ScanSummary, FindingsList, FindingDetail)
- Dashboard types: `src/dashboard/src/types.ts` (Finding, ScanResult interfaces)
- Output: `dispatch-output.json` (root) + `src/dashboard/public/dispatch-output.json` (copy for dev)

## Key Types
- `MergedReport` in collector.ts = what gets written to dispatch-output.json
- `ScanResult` in dashboard types.ts = client-side mirror of MergedReport (no worker_errors)
- `ConstructorBootstrap` in constructor/types.ts = input to construction worker (needs github_issue.repo, number, app_config, pr_config)
- `FixResult` = output of construction worker

## Constructor Worker Details
- Two execution modes: regex (`agent.ts` -> `fix.ts`) and Claude CLI subprocess (`claude-agent.ts` -> `agent-adapters/claude-agent-runner.ts`)
- `claude-agent-runner.ts` spawns `claude --print` CLI, not the `@anthropic-ai/sdk` npm package
- `@anthropic-ai/sdk` is NOT currently a dependency (needs `pnpm add`)
- `ANTHROPIC_API_KEY` is passed as env var to Blaxel sandbox
- `prompts.ts` has system/task prompts already written for the Claude agent mode
- `fix.ts` signature: `applyFix(parsed: ParsedIssue, bootstrap: ConstructorBootstrap): Promise<FixResult>`

## Conventions
- pnpm package manager, TypeScript throughout
- Root package.json has no PDF library yet
- Dashboard has no UI library (plain CSS in App.css, dark theme with CSS variables)
- Dashboard fetches `/dispatch-output.json` via polling (2s interval)
- Vite config is minimal (just react plugin, no proxy configured)

**Why:** Understanding the architecture prevents suggesting changes that break the pipeline or miss integration points.
**How to apply:** Always trace data flow through the pipeline when planning new features. Dashboard changes need to account for the polling model.

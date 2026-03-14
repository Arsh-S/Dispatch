# Research Topic: Shannon AI by Keygraph

**Research Date**: 2026-03-14
**Sources**: 15+ websites analyzed (GitHub, DeepWiki, security blogs, product documentation)

---

## Executive Summary

Shannon is an autonomous AI pentesting platform built by Keygraph. It exists in two editions: **Shannon Lite** (open-source, AGPL-3.0) and **Shannon Pro** (enterprise, closed-source). The core value proposition is "proof by exploitation" — Shannon only reports a vulnerability if it has produced a working, reproducible proof-of-concept exploit. This eliminates the false-positive problem that plagues traditional SAST/DAST tools.

Shannon is a **white-box AI pentester**: it is given access to an application's source code *and* a live running instance of that application. It uses the source code to reason about attack surface and data flows, then validates findings by attempting real exploits against the running app. This hybrid white-box/black-box approach is its primary architectural differentiator.

The system is built in TypeScript, orchestrated via Temporal (a durable workflow engine), and powered entirely by Anthropic's Claude Agent SDK. It executes 11 specialized agents across 5 sequential phases, with parallel execution in the vulnerability analysis and exploitation phases. As of March 2026, Shannon Lite has achieved a 96.15% success rate (100/104 exploits) on the XBOW benchmark (hint-free, source-aware variant).

---

## Key Findings

### Finding 1: "No Exploit, No Report" Policy
Shannon enforces a strict policy: a vulnerability is only included in the final report if an exploitation agent has successfully demonstrated a working proof-of-concept against the live application. If the exploit attempt fails, the finding is discarded entirely — it does not appear as a "potential" or "unconfirmed" finding. This is operationalized in Phase 4 (Exploitation) being conditional: exploitation agents only run at all if Phase 3 (Vulnerability Analysis) produced a non-empty queue for that category.

- Source: [GitHub - KeygraphHQ/shannon](https://github.com/KeygraphHQ/shannon)
- Source: [SHANNON-PRO.md](https://github.com/KeygraphHQ/shannon/blob/main/SHANNON-PRO.md)

### Finding 2: Multi-Agent Architecture with 5 Attack Domains
Shannon's parallel execution model centers on five attack domain agents that run concurrently in both the vulnerability analysis and exploitation phases:
1. **Injection** (SQL injection, command injection, etc.)
2. **XSS** (Cross-Site Scripting)
3. **SSRF** (Server-Side Request Forgery)
4. **Auth** (Authentication bypass, session management)
5. **Authz** (Authorization, broken access control, business logic)

This parallelism (5x) reduces total execution time dramatically compared to sequential scanning. Each vulnerability agent produces a JSON queue (e.g., `INJECTION_QUEUE.json`) if findings exist; the corresponding exploitation agent only runs if that queue file exists.

- Source: [KeygraphHQ/shannon | DeepWiki](https://deepwiki.com/KeygraphHQ/shannon)
- Source: [Getting Started | DeepWiki](https://deepwiki.com/KeygraphHQ/shannon/6.1-getting-started)

### Finding 3: Temporal for Durable Workflow Orchestration
Shannon uses [Temporal](https://temporal.io) — a durable execution engine — to manage the full pentesting pipeline. This gives Shannon crash recovery (a stalled agent doesn't restart the whole test), queryable progress, intelligent retry logic, and the ability to run long-running jobs reliably. The `pentestPipelineWorkflow` is the master workflow, and individual phase activities are registered as Temporal activities with heartbeat reporting to keep the workflow alive during long AI agent executions.

- Source: [shannon/CLAUDE.md](https://github.com/KeygraphHQ/shannon/blob/main/CLAUDE.md)
- Source: [Pre-recon heartbeat timeout issue](https://github.com/KeygraphHQ/shannon/issues/105)

### Finding 4: Per-Workflow Isolated MCP Server Instances
Each workflow run gets its own isolated MCP (Model Context Protocol) server instances. The factory creates these with `targetDir` captured in a closure, enabling thread-safe parallel execution across concurrent tests. This means multiple tests can run simultaneously without tool state contamination. Shannon uses Playwright MCP for browser automation and a custom MCP server for TOTP/2FA generation.

- Source: [DeepWiki Architecture](https://deepwiki.com/KeygraphHQ/shannon)

### Finding 5: Sub-Agent Spawning via Claude's Task Tool
Shannon uses Claude Agent SDK with `maxTurns: 10_000` and `bypassPermissions` mode. Within phases (especially pre-recon), the system spawns sub-agents via Claude's `Task` tool to perform parallel analysis. Real codebase scans involve each sub-agent making 100+ tool calls. This is a true hierarchical multi-agent pattern: a top-level phase agent orchestrates a swarm of specialized sub-agents.

- Source: [GitHub Issue #105](https://github.com/KeygraphHQ/shannon/issues/105)
- Source: [CLAUDE.md](https://github.com/KeygraphHQ/shannon/blob/main/CLAUDE.md)

### Finding 6: Shannon Pro — Full AppSec Platform
Shannon Pro extends Lite into a full application security platform with: SAST, SCA (Software Composition Analysis), secrets scanning, business logic security testing, CI/CD integration (GitHub PR scanning), self-hosted runner model (code never leaves customer infrastructure), compliance evidence generation (SOC 2, HIPAA, ISO 27001), and static-to-dynamic correlation (SAST findings are fed into the dynamic exploitation pipeline so every reported finding has a working PoC).

- Source: [SHANNON-PRO.md](https://github.com/KeygraphHQ/shannon/blob/main/SHANNON-PRO.md)

---

## Detailed Analysis

### Product Overview

Shannon is described as a "fully autonomous AI hacker" for web applications and APIs. A user provides:
1. A URL to the running application
2. The source code repository (cloned into `./repos/`)
3. A YAML configuration file (in `./configs/`) specifying auth settings, login flows, MFA/TOTP, and test scope

Shannon then runs entirely autonomously from source code analysis through exploitation and report generation, without human intervention at any step — including handling SSO, 2FA, and TOTP login flows automatically.

**Target use case**: Internal security reviews before production deployment, CI/CD pipeline integration, and compliance-driven continuous security testing.

### The Two-Edition Model

| Feature | Shannon Lite | Shannon Pro |
|---|---|---|
| License | AGPL-3.0 (open source) | Commercial (closed source) |
| Deployment | Self-hosted via Docker | Self-hosted runner + cloud control plane |
| Core pentesting | Yes | Yes |
| SAST | No | Yes |
| SCA | No | Yes |
| Secrets scanning | No | Yes |
| Business logic testing | No | Yes |
| CI/CD integration | No | Yes (GitHub PR scanning) |
| Compliance reporting | No | SOC 2, HIPAA, ISO 27001 |
| Static-dynamic correlation | No | Yes |
| Target users | Individual developers, small teams, local testing | Enterprise AppSec teams |

### Architecture Deep Dive

Shannon's architecture has three primary layers:

**Layer 1: Orchestration (Temporal)**
- Temporal server manages the `pentestPipelineWorkflow`
- Worker process (`src/temporal/worker.ts`) polls Temporal for tasks
- Activities (`src/temporal/activities.ts`) wrap phase execution with heartbeat loops, error classification, and container lifecycle management
- Client (`src/temporal/client.ts`) submits workflow runs
- Provides: crash recovery, queryable progress, retry logic, parallel fan-out

**Layer 2: AI Execution (Claude Agent SDK)**
- `src/ai/claude-executor.ts`: integrates Claude Agent SDK with retry logic via `runAgentWithRetry()`
- `maxTurns: 10_000` — agents can take extremely long autonomous runs
- `bypassPermissions` mode — agents can use all tools without per-action confirmation
- Per-workflow isolated MCP server instances for thread safety

**Layer 3: Multi-Agent Pipeline**
- `src/session-manager.ts`: determines agent execution order using `AGENT_QUEUE` and `PARALLEL_GROUPS`
- `src/services/agent-execution.ts` (`AgentExecutionService`): handles agent lifecycle via `AGENTS` registry
- `src/services/prompt-manager.ts`: resolves prompt templates with variable substitution

### The Five-Phase Pipeline

**Phase 1: Pre-Reconnaissance (Code Analysis)**
- Sequential; runs before any live network activity
- Parses and analyzes the source code repository
- Tools used: `Read`, `Grep`, `Glob`, `Bash` (static code analysis)
- Deliverable: `code_analysis_report.md` — maps all entry points, API endpoints, data flows, and authentication mechanisms
- Sub-agents are spawned via Claude's `Task` tool for parallel codebase analysis
- Also runs: Nmap (port scanning), Subfinder (subdomain enumeration), WhatWeb (technology fingerprinting)

**Phase 2: Reconnaissance (Live Application Exploration)**
- Sequential; active exploration of the running application
- Browser automation via Playwright MCP to correlate code-level findings with real-world behavior
- Schemathesis for API fuzzing and schema-based request generation
- Deliverable: `reconnaissance_report.md` — confirmed attack surface map

**Phase 3: Vulnerability Analysis (Parallel — 5 agents)**
- Five specialized agents run concurrently, one per attack domain
- Each performs structured data flow analysis tracing user input to dangerous sinks
- Agents: Injection, XSS, SSRF, Auth, Authz
- Deliverables: JSON queue files per category (e.g., `INJECTION_QUEUE.json`, `XSS_QUEUE.json`)
- Only populated queues trigger Phase 4 agents for that category

**Phase 4: Exploitation (Conditional Parallel — up to 5 agents)**
- Exploitation agents only run if the corresponding Phase 3 queue is non-empty
- Uses browser automation and CLI tools to attempt real exploits against the live application
- Handles 2FA/TOTP (via dedicated MCP server tool), SSO, form-based auth
- Any hypothesis that cannot be actively exploited is discarded
- Deliverables: Evidence files per category (e.g., `INJECTION_EVIDENCE`, `XSS_EVIDENCE`)

**Phase 5: Reporting**
- A dedicated report consolidation agent gathers all Phase 4 evidence
- Cleans noise and hallucinated artifacts
- Generates `comprehensive_security_assessment_report.md`
- Only confirmed, exploited vulnerabilities appear in the report
- Each finding includes: vulnerable location, HTTP method, severity, prerequisites, step-by-step exploitation steps, copy-paste PoC payload, and source code location (for Pro)

### Source Repository Structure

```
shannon/
├── src/
│   ├── ai/
│   │   └── claude-executor.ts          # Claude Agent SDK integration, runAgentWithRetry()
│   ├── audit/                          # Per-agent execution audit logs
│   ├── services/
│   │   ├── agent-execution.ts          # AgentExecutionService, AGENTS registry
│   │   ├── error-handling.ts           # ErrorCode enum, Result<T,E> pattern
│   │   ├── prompt-manager.ts           # Template loading, variable substitution
│   │   └── container.ts               # Container lifecycle management
│   ├── temporal/
│   │   ├── workflows.ts               # pentestPipelineWorkflow definition
│   │   ├── activities.ts              # runPhaseActivity(), heartbeat wrappers
│   │   ├── worker.ts                  # Temporal worker process
│   │   └── client.ts                  # Workflow submission client
│   ├── types/                         # TypeScript type definitions
│   ├── utils/                         # Shared utilities
│   ├── config-parser.ts               # YAML config parsing with JSON Schema validation
│   ├── progress-indicator.ts          # CLI progress display
│   ├── session-manager.ts             # AGENT_QUEUE, PARALLEL_GROUPS, execution ordering
│   └── splash-screen.ts               # CLI startup display
├── prompts/
│   ├── shared/
│   │   ├── login-instructions.txt     # Auth flow templates (form, SSO, API, basic)
│   │   └── [other shared partials]
│   ├── pre-recon.txt                  # Code analysis + tool discovery prompt
│   ├── recon.txt                      # Live application exploration prompt
│   ├── injection-vuln.txt             # Injection vulnerability analysis prompt
│   ├── xss-vuln.txt                   # XSS vulnerability analysis prompt
│   ├── ssrf-vuln.txt                  # SSRF vulnerability analysis prompt
│   ├── auth-vuln.txt                  # Authentication vulnerability analysis prompt
│   ├── authz-vuln.txt                 # Authorization vulnerability analysis prompt
│   ├── injection-exploit.txt          # Injection exploitation prompt
│   ├── xss-exploit.txt                # XSS exploitation prompt
│   ├── ssrf-exploit.txt               # SSRF exploitation prompt
│   ├── auth-exploit.txt               # Auth exploitation prompt
│   ├── authz-exploit.txt              # Authz exploitation prompt
│   └── report.txt                     # Final report consolidation prompt
├── mcp-server/                        # Custom MCP server implementation
├── configs/                           # YAML test configuration files (user-provided)
│   └── config-schema.json            # JSON Schema for config validation
├── repos/                             # Target application repositories (user-provided)
├── docker-compose.yml                 # Dev deployment (Temporal + worker)
├── docker-compose.release.yml         # Production deployment
├── .env.example                       # Environment variable template
├── CLAUDE.md                          # Developer reference (AI-readable context)
├── README.md                          # Primary documentation
├── SHANNON-PRO.md                     # Shannon Pro features and enterprise docs
└── xben-benchmark-results/            # XBOW benchmark test results
    └── README.md
```

### Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript (Node.js) |
| AI Model | Anthropic Claude (via `@anthropic-ai/claude-agent-sdk`) |
| Workflow Orchestration | Temporal (durable execution) |
| Browser Automation | Playwright (via Playwright MCP) |
| Container Runtime | Docker / Docker Compose |
| Network Scanning | Nmap |
| Subdomain Enumeration | Subfinder |
| Technology Fingerprinting | WhatWeb |
| API Fuzzing | Schemathesis |
| 2FA/TOTP | Custom MCP server tool |
| Config Format | YAML (with JSON Schema validation) |
| Error Handling | `Result<T,E>` pattern, `ErrorCode` enum |
| Prompt System | Template files with `{{VARIABLE}}` substitution |
| Monitoring | Temporal Web UI (workflow visibility) |

### Configuration System

Shannon uses YAML config files validated against a JSON Schema (`config-schema.json`). Key configuration parameters include:
- `target_url` — base URL of the running application
- `repo` — name of the repository directory under `./repos/`
- Auth settings (form-based, API key, basic auth)
- MFA/TOTP configuration
- Per-app testing parameters and scope restrictions
- Login instructions passed as `{{LOGIN_INSTRUCTIONS}}` to prompts

Prompt templates use three primary variables:
- `{{TARGET_URL}}` — the application URL
- `{{CONFIG_CONTEXT}}` — serialized config settings
- `{{LOGIN_INSTRUCTIONS}}` — resolved auth flow instructions

### Prompt Engineering Architecture

Each of the 11 agents has a dedicated prompt file in `prompts/`. Shared logic (login flows, common instructions) lives in `prompts/shared/` and is included by `PromptManager` at resolution time. This makes it straightforward to update individual agent behavior without touching orchestration code.

The CLAUDE.md file provides AI-readable context about the codebase architecture — it is explicitly designed to be consumed by Claude Code as a project reference document.

### Deployment Model

**Shannon Lite** uses Docker Compose with two primary services:
1. `temporal` — the Temporal server
2. `worker` — the Shannon worker container that executes the pentesting pipeline

An optional router service is available. The Temporal Web UI runs on port 8233 for monitoring workflow state.

**Startup command pattern**:
```
./shannon start URL=<url> REPO=my-repo CONFIG=./configs/my-config.yaml
```

**Shannon Pro** adds a self-hosted runner model analogous to GitHub Actions self-hosted runners. The control plane (scheduling, results UI, compliance dashboard) lives in Keygraph's cloud, but the data plane (code access, LLM API calls) runs entirely within the customer's own infrastructure using the customer's own Anthropic API keys.

### Vulnerability Coverage (Lite vs. Pro)

Shannon Lite covers five attack domains:
- SQL Injection / Command Injection / other injection types
- Cross-Site Scripting (XSS)
- Server-Side Request Forgery (SSRF)
- Authentication bypass (login flaws, session management)
- Authorization bypass / broken access control

Shannon Pro adds:
- Business logic invariant violations (routed to the Authz agent)
- Additional attack categories under active development
- SAST findings (static only, not requiring exploitation)
- SCA (dependency vulnerability scanning)
- Secrets detection

### Report Output Format

Final reports are written as Markdown files into `shannon/repos/<your-repo>/deliverables/`. The directory structure of a completed run:

```
deliverables/
├── code_analysis_report.md
├── reconnaissance_report.md
├── INJECTION_QUEUE.json           # If injection findings exist
├── XSS_QUEUE.json                 # If XSS findings exist
├── SSRF_QUEUE.json                # If SSRF findings exist
├── AUTH_QUEUE.json                # If auth findings exist
├── AUTHZ_QUEUE.json               # If authz findings exist
├── INJECTION_EVIDENCE             # If injection exploited
├── XSS_EVIDENCE                   # If XSS exploited
├── [evidence files per category]
└── comprehensive_security_assessment_report.md
```

Each vulnerability finding in the final report includes:
- Summary (high-level description)
- Vulnerable location (specific API endpoint and HTTP method)
- Overview (how the vulnerability works mechanically)
- Impact (potential damage)
- Severity rating
- Prerequisites (what an attacker would need)
- Step-by-step exploitation instructions
- Copy-paste PoC payload
- (Pro only) Exact source code location of the flaw

### Benchmark Performance

Shannon Lite scored **96.15% (100/104 exploits)** on the XBOW benchmark in white-box mode (source code available, hints disabled). Context: prior state-of-the-art AI agents on the original black-box XBOW benchmark scored ~85%. Shannon's benchmark was run with source code access, so these numbers are not directly comparable, but they demonstrate strong performance on a real-world security testing benchmark.

Real-world validation: Shannon identified 20+ vulnerabilities in OWASP Juice Shop, including complete authentication bypass and database exfiltration via SQL injection.

---

## Sources

1. [GitHub - KeygraphHQ/shannon](https://github.com/KeygraphHQ/shannon) — Primary repository; README, CLAUDE.md, SHANNON-PRO.md
2. [KeygraphHQ/shannon | DeepWiki](https://deepwiki.com/KeygraphHQ/shannon) — Auto-generated architecture documentation from codebase analysis
3. [Getting Started | DeepWiki](https://deepwiki.com/KeygraphHQ/shannon/6.1-getting-started) — Setup and workflow documentation
4. [SHANNON-PRO.md](https://github.com/KeygraphHQ/shannon/blob/main/SHANNON-PRO.md) — Shannon Pro enterprise feature documentation
5. [CLAUDE.md](https://github.com/KeygraphHQ/shannon/blob/main/CLAUDE.md) — Developer/AI-readable architecture reference
6. [Proof by Exploitation: Shannon's Approach (Medium)](https://medium.com/@parathan/proof-by-exploitation-shannons-approach-to-autonomous-penetration-testing-010eac3588d3) — Deep-dive on the "no exploit, no report" philosophy
7. [AI Penetration Testing with Shannon | Better Stack](https://betterstack.com/community/guides/ai/shannon-ai/) — Practical guide with deliverables directory structure details
8. [Meet Shannon by Keygraph (EMSI)](https://www.emsi.me/tech/ai-ml/meet-shannon-by-keygraph-the-ai-breakthrough-in-autonomous-web-security-testing/2026-03-11/113a52) — Product overview and feature summary
9. [Shannon: Autonomous AI Tool with Nmap Integration (GBHackers)](https://gbhackers.com/shannon-autonomous-ai-tool-with-nmap-integration/) — Technical details on external tool integrations
10. [Shannon: AI Pentesting Tool (GBHackers)](https://gbhackers.com/shannon-ai-pentesting-tool/) — Additional vulnerability coverage details
11. [Pre-recon heartbeat timeout issue](https://github.com/KeygraphHQ/shannon/issues/105) — GitHub issue revealing sub-agent spawning architecture
12. [Shannon by KeygraphHQ: The Open-Source AI Pentester (UnderCode News)](https://undercodenews.com/shannon-by-keygraphhq-the-open-source-ai-that-fully-automates-web-application-penetration-testing/) — Overview with architecture details
13. [Shannon: AI Security Hacker Setup Guide (Decision Crafters)](https://www.decisioncrafters.com/shannon-ai-security-hacker-96-percent-success-rate/) — Practical deployment documentation
14. [Shannon AI Pentesting Tutorial (ByteIota)](https://byteiota.com/shannon-ai-pentesting-tutorial-autonomous-security-testing/) — Configuration and usage guide
15. [Shannon: The Autonomous AI Pentester in 2026 (Medium/Lalatendu)](https://lalatenduswain.medium.com/shannon-the-autonomous-ai-pentester-that-changes-web-security-in-2026-da9111be8357) — 2026 perspective and capabilities summary

---

## Conclusions

Shannon is a well-engineered, production-quality autonomous security testing system. Its design decisions are coherent and mutually reinforcing: Temporal for durability, parallel OWASP-domain agents for speed, the "no exploit, no report" policy for precision, and prompt-file-per-agent for maintainability.

Several architectural elements stand out as particularly sophisticated:
- The conditional Phase 4 execution (queue-gated exploitation) elegantly eliminates false positives at the pipeline level
- Per-workflow MCP server isolation enables true parallel test runs without state contamination
- The `maxTurns: 10_000` + `bypassPermissions` configuration signals that Shannon is designed for deep, autonomous operation with no human checkpoints
- The CLAUDE.md file as a machine-readable architecture guide is an interesting pattern for keeping AI agents oriented in complex codebases

---

## Relevance to Dispatch: Integration and Inspiration Opportunities

### High-Value Patterns to Adopt

**1. Temporal for Scan Orchestration**
Dispatch could adopt Temporal to manage multi-step security scan pipelines. Benefits directly applicable: crash recovery across long-running scans, queryable scan state, intelligent retry on transient failures, and parallel fan-out across multiple scan types or targets. The `pentestPipelineWorkflow` pattern — a master workflow that fans out to phase-specific activities — maps cleanly to a "scan job" model.

**2. Domain-Specific Parallel Workers**
The 5-agent parallel model (one agent per attack domain, running concurrently) could translate to Dispatch running parallel specialized scan workers (SAST worker, DAST worker, SCA worker, secrets worker) with results aggregated in a final reporting phase. The JSON queue pattern (Phase 3 → Phase 4 conditional gate) is a clean way to avoid running expensive steps when there is nothing to process.

**3. Queue-Gated Conditional Execution**
Shannon's pattern of Phase 3 producing `INJECTION_QUEUE.json` and Phase 4 only running if that file is non-empty is directly applicable to Dispatch. For example: a lightweight "triage" scan produces a list of suspect endpoints, and an expensive "deep scan" only runs on those endpoints. This prevents wasting compute on clean targets.

**4. Prompt-Per-Agent Architecture**
Shannon's approach of keeping one prompt file per agent, with shared partials assembled by a `PromptManager`, is a maintainable way to build an AI-driven security system. Dispatch could adopt this pattern if it uses LLMs for intelligent analysis — having agent behavior defined in editable text files rather than embedded in code makes tuning and iteration much faster.

**5. Result Type Pattern for Error Handling**
`Result<T, E>` with `ErrorCode` enum is a clean approach to explicit error propagation in an async, multi-step pipeline where partial failures need to be classified and handled differently (retry vs. skip vs. abort).

**6. MCP Tool Integration Pattern**
Shannon's pattern of wrapping security tools (Nmap, Subfinder, WhatWeb, Schemathesis, Playwright) as MCP server tools that Claude agents can call directly is a powerful extensibility model. Dispatch could expose its own scanning capabilities or third-party tool integrations as MCP tools, enabling AI-driven orchestration of heterogeneous security tooling.

**7. CLAUDE.md as Machine-Readable Context**
The CLAUDE.md pattern — a developer-facing document that also serves as context for AI agents working on the codebase — is worth adopting in Dispatch. It helps both human contributors and any AI-assisted development stay aligned on architecture without re-reading the entire codebase.

### Direct Code/Pattern Candidates for Reuse

Shannon Lite is AGPL-3.0. Any code reuse requires either:
- The Dispatch project itself being AGPL-3.0 licensed, or
- Rewriting inspired-by (not copy-pasted) implementations, or
- Purchasing a commercial license from Keygraph

Patterns that could be reimplemented independently (inspired by Shannon):
- Temporal workflow structure for scan pipeline orchestration
- Queue-file gating pattern for conditional phase execution
- Per-agent prompt file system with shared partials
- Docker Compose service topology (orchestrator + worker containers)
- Deliverables directory output format with per-phase artifact files

### Gaps Where Dispatch Could Differentiate

- **Multi-target orchestration**: Shannon is designed for single-target runs. Dispatch could extend the model to manage campaigns across many targets simultaneously with a centralized findings database.
- **Cross-scan correlation**: Shannon Pro correlates SAST + DAST within a single target, but Dispatch could correlate findings across targets, time (regression tracking), and scan types.
- **Findings persistence and deduplication**: Shannon outputs flat markdown files. Dispatch could provide structured storage, deduplication, CVSS scoring, and SLA-based remediation tracking.
- **Non-web targets**: Shannon focuses on web apps and APIs. Dispatch could extend to infrastructure (cloud config, containers, IaC) using the same orchestration patterns.
- **Integrations ecosystem**: Shannon Pro has GitHub PR integration. Dispatch could build broader integrations (Jira, Slack, PagerDuty, ticketing systems) on top of a structured findings store.

---

## Additional Notes

- Shannon's AGPL-3.0 license is a strong copyleft license. Any product that bundles or derives from Shannon Lite must also be AGPL-3.0 if distributed. This is a significant constraint for a commercial security product like Dispatch. Shannon Pro (commercial) exists for enterprise deployments that cannot accept the AGPL terms.
- The XBOW benchmark results are in white-box mode, which is more favorable than the black-box results reported by competing tools. Direct comparisons to other AI security tools should account for this methodological difference.
- Shannon requires the application under test to be running locally. It is not designed for passive scanning of production systems from source code alone — it needs a live target to exploit.
- Shannon is a very young project (major public attention as of early 2026). The GitHub issues log shows active development and some instability in edge cases (heartbeat timeouts, sub-agent failures). It should be considered pre-1.0 for production use.
- The Anthropic API dependency means Shannon's costs scale with LLM token consumption. Each full scan on a real codebase involves thousands of agent turns and significant API spend.

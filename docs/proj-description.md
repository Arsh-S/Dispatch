# Dispatch
### Cornell AI Hackathon NYC 2026 | AI Unleashed
**Track:** Alignment at Scale

---

> **Security tools give you a PDF. Dispatch gives you a pull request.**

---

## One-Line Description

Dispatch reads your codebase, autonomously plans and executes security tests against your application, compiles findings into an interactive dashboard and PDF reports, creates tickets in Linear, and deploys worker agents that fix the code and open pull requests — all triggered from Slack, your terminal, or a dashboard.

---

## What It Is

Dispatch is an AI-powered, code-aware security testing platform built around a multi-agent architecture. A commander agent (the Orchestrator) ingests your codebase, reads your rules and specs, then dispatches specialized worker agents to test your application for vulnerabilities. Results compile into an interactive graph view, condensed PDF reports, and automatically flow into Linear or GitHub Issues as actionable tickets. Worker agents can then attempt to fix the vulnerabilities, open PRs, and even redeploy and re-test to verify the fix — a full monkey-patching loop. A RAG system lets developers ask natural language questions about the findings for deeper context.

---

## Architecture

### The Orchestrator

The Orchestrator is the commander agent. It ingests:

- **Codebase** — the full repo, respecting a `.dispatchignore` file (like `.gitignore` but for files Dispatch shouldn't scan)
- **Spec** — test instructions from the developer describing what they want tested and how
- **RULES.md** — a configuration file where the team defines security rules, policies, and priorities specific to their application

From these inputs, the Orchestrator maps:

- **API → Keys** — identifies API keys, secrets, and credentials in the codebase
- **Auth → Endpoints** — maps authentication logic to which endpoints it protects (and which it doesn't)
- **Auto → Datadog Logs** — connects to existing Datadog/Grafana observability to pull runtime context into the attack planning

The Orchestrator then creates an attack plan, dispatches workers, collects their reports, and compiles the final output.

---

### Dispatch Workers

Workers are specialized attacker agents, each assigned specific targets from the Orchestrator's plan:

| Worker | What It Tests |
|---|---|
| **Route Scanner** | Auth gaps, rate limiting, input validation, IDOR |
| **Injection Worker** | SQL injection, command injection, XSS, path traversal |
| **Auth Worker** | JWT tampering, session fixation, privilege escalation, broken access control |
| **AI/Agent Security Worker** | Prompt injection, system prompt leakage, tool poisoning, goal hijacking (OWASP Agentic Top 10) |
| **Config Worker** | Exposed secrets, misconfigured CORS, insecure headers, open debug endpoints |
| **UI Worker** | BrowserBase-powered headed webdriver — tests forms, client-side validation, XSS in rendered pages, auth flows visually |

Each worker reports findings back to the Orchestrator with the exact file, line number, severity, and suggested fix.

---

### Fixer Workers

After findings are compiled, Fixer Workers can:

1. Read the vulnerability report
2. Navigate to the exact code location
3. Write a patch (add input sanitization, add auth middleware, parameterize a query)
4. Open a pull request with the fix and an explanation
5. **Redeploy and re-test** (monkey-patching loop) — deploy the patched version to staging and re-run the specific test that found the vulnerability
6. Report back to the Orchestrator with pass/fail status

---

### Testing Modes

- **Whitebox** — full codebase access. Attack planning informed by actual code patterns. Primary mode.
- **Graybox** — partial access. Some code context (e.g., API specs, route definitions) but tests endpoints without full source visibility. Useful for third-party services or microservices.

---

## Integrations

### Datadog / Grafana
Dispatch pulls existing observability data to inform its testing. Spikes in 500 errors on a specific route? That route gets tested with higher priority. After testing, findings can also be pushed back as structured events so your existing monitoring dashboards reflect the security posture.

### Slack Bot
```
"Hey @Dispatch launch 5 workers to address ticket #13 on the repository."
```
Results flow back into the Slack thread with a summary and links to the Linear tickets and PRs created. The barrier to running a security test drops to zero — no CLI, no configuration, just a Slack message.

### Linear / GitHub Issues
Every finding automatically becomes a ticket with:
- Severity (Critical / High / Medium / Low)
- OWASP classification
- Exact file and line number
- Reproduction steps
- Suggested fix
- Link to the PR if a fixer worker has already attempted a patch

The integration works both ways — from a ticket, you can click **"Send Dispatch Workers"** to trigger investigation and automated remediation.

---

## Reporting

### Interactive Graph View
Inspired by Obsidian's graph view — a read-only, interactive network visualization where:
- **Nodes** represent endpoints, files, and findings
- **Edges** show relationships (which file serves which endpoint, which finding affects which route)
- Color coding by severity
- Click any node to drill into the finding detail

### PDF Reports
Organized by severity with zero padding — every page has actionable content:

1. **Executive Summary** — one page, highest-level stats and overall risk score
2. **Critical Findings** — full detail with code locations, reproduction steps, and remediation guidance
3. **High Findings** — same format
4. **Medium / Low Findings** — condensed format

PDFs include GitHub permalinks and links to every Linear/GitHub ticket created.

### RAG System for Developer Q&A
After a scan, all findings are indexed into a RAG system. Developers can ask:

- *"What's the most critical finding and how do I fix it?"*
- *"Are any of our payment endpoints vulnerable?"*
- *"Explain the JWT vulnerability you found in auth.js"*
- *"What would happen if an attacker exploited the SQL injection on the orders route?"*

Instead of reading a 20-page PDF, the developer asks what they need to know and gets a direct, contextual answer with code references.

---

## The Problem

**Security testing is slow, expensive, and disconnected from developer workflows.**

- Professional penetration tests cost **$5,000–$100,000+** per engagement and happen once or twice a year
- The global pentesting market was valued at **$2.74B in 2025**, projected to reach **$7.41B by 2034** (11.6% CAGR)
- **45.4%** of discovered vulnerabilities in large enterprises remain unpatched after 12 months (Edgescan 2025)
- **17.4%** of those unpatched vulnerabilities are high or critical severity
- Average time to remediate: **60–150 days**
- Three-quarters of developers spend up to **17 hours/week** on security-related tasks (Snyk 2025)
- IBM 2025: average breach cost **$4.44M** globally, **$10.22M** in the U.S.
- Organizations using AI/automation in security saved an average of **$1.9M per breach**
- Vulnerability exploitation was the **#1 cause of cyberattacks in 2025**, responsible for 40% of observed incidents (IBM X-Force 2026)

**The remediation gap is where the real cost lives.** Security tools find vulnerabilities. Nobody closes the loop to a fix.

---

## Why This Is Different

| Capability | Casco | Snyk Agent Scan | Straiker | Traditional Pentest | **Dispatch** |
|---|:---:|:---:|:---:|:---:|:---:|
| Code-aware attack planning | ✗ | ✗ | ✗ | ✗ | ✅ |
| RULES.md configuration | ✗ | ✗ | ✗ | ✗ | ✅ |
| Datadog/Grafana integration | ✗ | ✗ | ✗ | ✗ | ✅ |
| Slack bot trigger | ✗ | ✗ | ✗ | ✗ | ✅ |
| Auto Linear/GitHub tickets | ✗ | ✗ | ✗ | ✗ | ✅ |
| Fixer workers + PRs | ✗ | ✗ | ✗ | ✗ | ✅ |
| Monkey-patching redeploy loop | ✗ | ✗ | ✗ | ✗ | ✅ |
| UI testing via BrowserBase | ✗ | ✗ | ✗ | ✗ | ✅ |
| RAG conversational Q&A | ✗ | ✗ | ✗ | ✗ | ✅ |
| Live endpoint testing | ✅ | ✗ | ✅ | ✅ | ✅ |

---

## Target Users

**Primary — Development teams at startups and mid-size companies (5–50 developers)**
Shipping fast, know they need security testing but can't afford $20K–$100K pentests and don't have a dedicated security team.

**Secondary — Security teams at larger companies**
Drowning in vulnerability backlogs. 45.4% of their findings sit unpatched after 12 months. Dispatch's ticket + fixer pipeline directly addresses the remediation gap.

**Tertiary — Compliance-driven organizations**
Companies needing documented penetration test results for SOC 2, HIPAA, PCI DSS, or ISO 27001. PCI DSS v4.0 (mandatory since March 2025) requires penetration tests at least annually.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Multi-agent orchestration | Mastra |
| Agent reasoning | OpenRouter (multi-model) |
| Ticket creation | Linear API / GitHub Issues API |
| UI testing | BrowserBase (via MCP) |
| Dashboard | React |
| Conversational Q&A | RAG framework |
| Sandboxed execution (optional) | Blaxel |

---

## Configuration Files

### `.dispatchignore`
Like `.gitignore` — tells Dispatch which files/directories to skip during code analysis (e.g., `node_modules`, build artifacts, test fixtures).

### `RULES.md`
Developer-defined security rules and priorities. Examples:
```
- All API endpoints must require authentication
- No raw SQL queries — must use parameterized statements
- JWT tokens must verify signature and check expiration
- No hardcoded API keys or secrets in source files
- Payment endpoints are critical priority
```
The Orchestrator reads `RULES.md` to weight findings and customize the attack plan.

---

## Demo Script (3 minutes)

1. **"Here's a codebase."** Show the repo with a `RULES.md` file defining security priorities.
2. **"I tell Dispatch what to test."** Type: *"Test all API routes for auth issues, injection vulnerabilities, and secrets exposure."*
3. **"The Orchestrator reads the code and plans."** Show output: *"Found 5 routes. 2 have no auth middleware. Database queries in orders.js use string concatenation. JWT verification doesn't check signature. Planning 3 attack phases. Dispatching 3 workers."*
4. **"Workers deploy."** Dashboard streams findings live — severity-coded, each with file name, line number, and what happened.
5. **"Findings become tickets."** Show Linear or GitHub Issues — tickets already created with severity, code location, reproduction steps, and suggested fix.
6. **"Dispatch fixes it."** Show the fixer worker opening a PR that replaces unsafe code with a parameterized query. PR description explains the vulnerability and the fix.
7. **"And developers can ask questions."** Show the RAG Q&A: *"What's the most critical issue?"* → direct answer with code reference and remediation steps.

> **Closing line: "Security tools give you a PDF. Dispatch gives you a pull request."**

---

## 36-Hour Execution Plan

### Friday Night (6–9 PM)
- Build sample vulnerable app (Express or FastAPI, 4–5 routes with deliberate vulnerabilities)
- Set up Orchestrator agent — reads codebase, parses `RULES.md`, identifies routes
- Wire up GitHub Issues API

### Saturday Morning (9 AM–12 PM)
- Build Worker #1: Route/Auth scanner
- Build Worker #2: Injection tester
- Orchestrator dispatching — assigns targets to workers, collects results

### Saturday Afternoon (12–5 PM)
- Build interactive web dashboard (graph view, severity colors, code references)
- Wire results → GitHub Issues / Linear (automatic ticket creation)
- Test end-to-end
- Set up RAG index over findings

### Saturday Evening (5–8:30 PM)
- Build Fixer Worker for SQL injection
- If time: monkey-patching loop, Slack bot, PDF report generation
- Attend pitch workshop at 6 PM

### Sunday Morning (before 9:10 AM)
- Record demo video
- Build MakePortals demo page
- Finalize pitch deck
- Submit via Airtable

### Priority Stack

| Priority | Feature |
|---|---|
| **Must have** | Orchestrator reads code → 2 workers test endpoints → dashboard shows findings → tickets created |
| **Should have** | Fixer worker opens a PR · RAG Q&A · PDF report |
| **Nice to have** | Monkey-patching loop · Slack bot · Datadog integration · UI testing · Graph view |

---

## Hackathon Track Fit: Alignment at Scale

The track asks teams to make AI systems *"more understandable and measurable"* and to *"clarify failure modes and limits, not claim complete safety."*

- **Makes security measurable** — CVSS scores, OWASP mappings, severity-organized PDFs
- **Clarifies failure modes** — each finding shows exactly how and where the system breaks
- **Doesn't claim complete safety** — shows developers where problems are and helps fix them
- **Transparent multi-agent architecture** — Orchestrator reasoning is logged throughout

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Multi-agent orchestration in 36 hours is ambitious | Scope to 2 workers, 1 fixer, one sample app |
| Code analysis quality depends on LLM capability | Use a simple, well-structured sample app |
| BrowserBase/UI testing adds complexity | Treat as nice-to-have, cut if behind |
| AI security space is crowded | Differentiate on closed-loop (code → tickets → PRs → verify) and dev experience |
| Blaxel (sponsor) is a Casco customer | Position as complementary: *"Casco audits production. Dispatch lives in your dev workflow."* |

---

## Expansion Story

> *"Today, Dispatch tests one codebase on demand. Tomorrow, it runs in CI/CD — every push gets tested before merge. It pulls context from Datadog to prioritize real-world risk. Developers trigger it from Slack. Findings become tickets. Tickets become PRs. PRs get verified by re-testing. The pentesting market is $2.7 billion. The remediation market doesn't formally exist yet — because nobody's built the tool that closes the loop. We are."*
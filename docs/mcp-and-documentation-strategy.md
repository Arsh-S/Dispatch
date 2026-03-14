# Dispatch — MCP & Documentation Strategy

> **Generated:** 2026-03-14
> **Purpose:** Define the MCP servers and documentation sources needed for both the building agent (Claude Code) and the runtime Dispatch agent.

---

## Two-Layer MCP Architecture

Dispatch needs MCPs at **two layers**:

1. **Build-time MCPs** — Help Claude Code write correct Dispatch code (docs lookup, API references)
2. **Runtime MCPs** — Used by the Dispatch agent itself during scans (GitHub Issues, Slack, Linear, etc.)

---

## Layer 1: Build-Time MCPs (for Claude Code)

These MCPs help the building agent write correct code against current APIs.

### CRITICAL

| MCP | Package / Endpoint | What It Does | Config |
|---|---|---|---|
| **Mastra Docs** | `@mastra/mcp-docs-server` v1.1.10 | Full Mastra documentation, code examples, TypeScript types, API surface. **Purpose-built for AI-assisted Mastra development.** | `npx -y @mastra/mcp-docs-server` |
| **Context7** | `@upstash/context7-mcp` | Live documentation for Express.js, GitHub API (Octokit), Sentry SDK, Slack Bolt. Resolves library names to current docs. | `npx -y @upstash/context7-mcp@latest` |

### HIGH

| MCP | Package / Endpoint | What It Does | Config |
|---|---|---|---|
| **Firecrawl** | `firecrawl-mcp` | Scrape docs not in Context7 index (Blaxel SDK, Linear SDK, Datadog SDK, OWASP guides). Returns clean markdown. | `npx -y firecrawl-mcp` + `FIRECRAWL_API_KEY` |

### Build-Time MCP Config (Claude Code `.claude.json` or `settings.json`)

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
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "<your-key>"
      }
    }
  }
}
```

### Documentation Access Matrix

| Documentation | Primary Source | Fallback |
|---|---|---|
| Mastra framework (agents, tools, workflows, MCP) | `@mastra/mcp-docs-server` | Context7 `resolve-library-id: mastra` |
| Blaxel SDK (sandboxes, fs, process) | Firecrawl → `docs.blaxel.ai` | Context7 (verify with `resolve-library-id: blaxel`) |
| Blaxel + Mastra integration | Firecrawl → `npmjs.com/@blaxel/mastra` | `@mastra/mcp-docs-server` (may cover integration) |
| Express.js middleware | Context7 → `express` | Built-in LLM knowledge (mature lib) |
| GitHub REST API (Issues, Labels, PRs) | Context7 → `octokit` | Firecrawl → `docs.github.com/en/rest` |
| Slack Bolt for Python | Context7 → `slack-bolt-python` | Firecrawl → `docs.slack.dev/tools/bolt-python` |
| Slack Events API / WebClient | Context7 → `slack-sdk` | Firecrawl → `docs.slack.dev` |
| Sentry Python SDK | Context7 → `sentry-python` | Firecrawl → `docs.sentry.io/platforms/python` |
| Datadog Python library | Context7 → `datadogpy` | Firecrawl → `github.com/DataDog/datadogpy` |
| Linear SDK | Context7 → `linear-sdk` | Firecrawl → `github.com/linear/linear` |
| OWASP Juice Shop API | Firecrawl → `pwning.owasp-juice.shop` | Fetch `swagger.yml` from GitHub |
| OWASP Testing Methodology | Firecrawl → `owasp.org/www-project-web-security-testing-guide` | — |
| OpenRouter + Mastra | `@mastra/mcp-docs-server` | Firecrawl → `openrouter.ai/docs/guides/community/mastra` |

---

## Layer 2: Runtime MCPs (for Dispatch Agent)

These MCPs are used by the Dispatch agent during live operation.

### CRITICAL

| MCP | Package / Endpoint | Tools | Auth |
|---|---|---|---|
| **GitHub** (official) | `github/github-mcp-server` | `create_issue`, `get_issue`, `update_issue`, `add_labels_to_issue`, `create_pull_request`, `merge_pull_request`, `search_code` | GitHub PAT (`repo` scope) |

```json
{
  "github": {
    "command": "docker",
    "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
    "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<pat>" }
  }
}
```

### HIGH

| MCP | Package / Endpoint | Tools | Auth |
|---|---|---|---|
| **Slack** | `@modelcontextprotocol/server-slack` | `slack_post_message`, `slack_reply_to_thread`, `slack_list_channels`, `slack_get_channel_history`, `slack_add_reaction` | `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` |
| **Linear** (official remote) | `https://mcp.linear.app/mcp` via `mcp-remote` | 21 tools: `create_issue`, `update_issue`, `list_issues`, `create_comment`, `list_projects`, `list_teams`, `list_labels` | Linear OAuth or API key |
| **Sentry** (official remote) | `https://mcp.sentry.io` or `npx @sentry/mcp-server@latest` | 16 tools: project list, issue search, event details, **Seer AI root cause analysis** | Sentry OAuth or access token |
| **Datadog** (official remote) | `docs.datadoghq.com/bits_ai/mcp_server/` | Logs, metrics, APM traces, dashboards, monitors, incidents, RUM, error tracking | DD API key + App key |

### MEDIUM — Security Testing

| MCP | Package / Endpoint | Tools | Auth |
|---|---|---|---|
| **BrowserBase** | `@browserbasehq/mcp-server-browserbase` or hosted SHTTP | `navigate`, `act`, `observe`, `extract`, `start`, `end` — cloud-headed browser for UI testing | `BROWSERBASE_API_KEY` (+ `GEMINI_API_KEY` for custom models) |
| **OWASP ZAP** | `lisberndt/zap-mcp-server` | `start_spider`, `start_active_scan`, `start_ajax_spider`, `get_alerts`, `generate_report` | ZAP API key |
| **Playwright** | `@playwright/mcp` | Navigate, click, fill, evaluate JS, get accessibility tree | None (local browser) |
| **Security Tools** | `cyproxio/mcp-for-security` | SQLMap, FFUF, Nmap, Masscan | None (local CLIs) |
| **Security Hub** | `FuzzingLabs/mcp-security-hub` | Nuclei (template-based CVE scanning), Nmap, SQLMap | None (local CLIs) |

### Runtime MCP Config

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<pat>" }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_TEAM_ID": "T0..."
      }
    },
    "linear": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
    },
    "sentry": {
      "command": "npx",
      "args": ["-y", "@sentry/mcp-server@latest", "--access-token", "<token>"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "browserbase": {
      "command": "npx",
      "args": ["-y", "@browserbasehq/mcp-server-browserbase"],
      "env": {
        "BROWSERBASE_API_KEY": "<from https://www.browserbase.com/overview>",
        "GEMINI_API_KEY": "<optional — for Stagehand AI, default: google/gemini-2.5-flash-lite>"
      }
    }
  }
}
```

---

## OWASP Juice Shop Integration Notes

The plan currently builds a custom vulnerable Express app. Using OWASP Juice Shop instead offers significant advantages:

### Why Juice Shop

- **Zero build time** — `docker run -d -p 3000:3000 bkimminich/juice-shop`
- **100+ vulnerabilities** across all OWASP Top 10 categories
- **Built-in challenge tracking** — `GET /api/Challenges` returns JSON with `solved` boolean per vuln
- **Swagger/OpenAPI spec** — ships as `swagger.yml`, live at `/api-docs`
- **Webhook support** — Juice Shop can POST to Dispatch when a challenge is solved
- **Industry recognition** — OWASP flagship project, instant credibility with judges
- **Code snippets endpoint** — `/snippets/<key>` returns the vulnerable source code

### Key Limitation

Juice Shop is a **standalone monolith** — NOT middleware-injectable. Dispatch interacts over HTTP as a sidecar, not by injecting middleware. This changes the plan's middleware injection approach.

### Integration Pattern

```yaml
# docker-compose.yml
services:
  juice-shop:
    image: bkimminich/juice-shop:latest
    ports: ["3000:3000"]
  dispatch:
    build: .
    ports: ["4000:4000"]
    environment:
      TARGET_URL: http://juice-shop:3000
    depends_on: [juice-shop]
```

### Key Endpoints for Dispatch

| Endpoint | Use |
|---|---|
| `GET /api/Challenges` | Vulnerability catalog + live scoreboard |
| `POST /rest/user/login` | SQL injectable login (demo target) |
| `GET /rest/products/search?q=` | SQL injectable search (demo target) |
| `GET /api-docs` | Live Swagger UI |
| `GET /snippets/<key>` | Vulnerable source code for each challenge |
| `GET /metrics` | Prometheus metrics (info disclosure) |

### Recommended Scanning Flow via MCPs

1. **Playwright MCP** → Navigate to Juice Shop, authenticate as admin (`admin@juice-sh.op` / `admin123`)
2. **ZAP MCP** → `start_ajax_spider` (critical for Angular SPA)
3. **ZAP MCP** → `start_active_scan` on spidered URLs
4. **ZAP MCP** → `get_alerts` to retrieve structured findings
5. **Security MCP** → SQLMap against `/rest/products/search?q=`
6. **GitHub MCP** → `create_issue` per finding with severity labels
7. **Linear MCP** → Create tickets linked to GitHub issues
8. **Slack MCP** → Post summary to channel
9. **Sentry MCP** → Retrieve any scanner errors for debugging

---

## Key Package Versions

| Package | Version | Purpose |
|---|---|---|
| `@mastra/core` | 1.10.0 | Core framework |
| `@mastra/mcp-docs-server` | 1.1.10 | Build-time docs MCP |
| `@blaxel/core` | 0.2.66 | Sandbox SDK |
| `@blaxel/mastra` | 0.2.43 | Mastra-Blaxel integration |
| `@upstash/context7-mcp` | latest | Documentation resolution |
| `@playwright/mcp` | latest | Browser automation |
| `@modelcontextprotocol/server-slack` | latest | Slack integration |
| `@sentry/mcp-server` | latest | Sentry integration |

---

## Mastra Quick Reference (for building agent)

### Agent Definition
```typescript
import { Agent } from "@mastra/core/agent";
const agent = new Agent({
  name: "orchestrator",
  instructions: "...",
  model: "openrouter/anthropic/claude-sonnet-4",
  tools: { scanTool, issueTool },
});
```

### Tool Definition
```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
const myTool = createTool({
  id: "my-tool",
  description: "...",
  inputSchema: z.object({ ... }),
  outputSchema: z.object({ ... }),
  execute: async ({ input }) => { ... },
});
```

### MCP Client (consuming external MCPs)
```typescript
import { MCPClient } from "@mastra/core/mcp";
const mcp = new MCPClient({
  servers: {
    github: { url: new URL("https://..."), requestInit: { headers: { Authorization: "Bearer ..." } } },
  },
});
```

### Agent Network (multi-agent)
```typescript
import { AgentNetwork } from "@mastra/core/agent";
const network = new AgentNetwork({
  name: "dispatch-network",
  instructions: "Route tasks to the appropriate agent",
  model: openrouter("anthropic/claude-sonnet-4"),
  agents: [orchestratorAgent, pentesterAgent, constructorAgent],
});
```

### Blaxel Sandbox (for worker execution)
```typescript
import { SandboxInstance } from "@blaxel/core";
const sandbox = await SandboxInstance.createIfNotExists({
  name: "pentester-worker-1",
  ports: [{ name: "app", port: 3000, protocol: "HTTP" }],
  ttl: 3600,
});
await sandbox.fs.write("/dispatch/task-assignment.json", JSON.stringify(task));
await sandbox.process.exec({ command: "npm install", workingDir: "/app" });
// Each sandbox auto-exposes MCP at <sandbox-url>/mcp
```

---

## Action Items

1. **Immediately configure build-time MCPs** — Add `@mastra/mcp-docs-server` + `@upstash/context7-mcp` to Claude Code settings
2. **Configure BrowserBase (optional)** — Copy `.cursor/mcp.json.example` → `.cursor/mcp.json`, add `BROWSERBASE_API_KEY` from [browserbase.com/overview](https://www.browserbase.com/overview). Add `BROWSERBASE_API_KEY` to `backend/.env` for runtime use.
3. **Verify Context7 coverage** — Run `resolve-library-id` for: mastra, blaxel, slack-bolt, linear-sdk, datadogpy. Submit missing ones at `context7.com/add-library`
4. **Get API keys** — GitHub PAT, Slack Bot Token, Linear API key, Sentry token, Datadog API+App keys, Firecrawl API key, BrowserBase API key
5. **Decision: Juice Shop vs Custom App** — Juice Shop saves hours of build time but changes middleware injection approach. For hackathon, Juice Shop is recommended.
6. **Set up ZAP MCP** — `pip install` the ZAP MCP server + run ZAP daemon in Docker for security scanning
7. **Test Blaxel sandbox MCP** — Each sandbox exposes MCP at `<url>/mcp` — verify this works for agent-to-sandbox communication

---

## Sources

All findings sourced from 80+ web pages. Full research files at:
- `/home/md2292/agent/research/dispatch-mcp-servers-20260314-120000.md`
- `/home/md2292/agent/research/context7-mcp-server-20260314-120000.md`
- `/home/md2292/agent/research/dispatch-tech-stack-mastra-blaxel-openrouter-20260314-000000.md`
- `/home/md2292/agent/research/owasp-juice-shop-dispatch-research-20260314-120000.md`

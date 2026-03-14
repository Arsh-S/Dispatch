# Live Agent Graph Test

Test the frontend graph view with real-time agent status as the orchestrator dispatches pentester workers on buggy API routes.

## Quick Start

**Terminal 1 — Frontend (graph view):**
```bash
cd frontend && pnpm dev
```
Open http://localhost:3000/dispatch

**Terminal 2 — Run scan (from backend):**
```bash
cd backend && pnpm scan:sample
```

The scan writes `dispatch-output.json` directly to `frontend/public/`. The frontend polls every 2 seconds and will show:

- **Orchestrator** node (center)
- **Cluster** nodes by attack type (sql-injection, xss, broken-auth, etc.)
- **Worker** nodes as they move from `queued` → `running` → `success`/`failed`
- **Finding** nodes when vulnerabilities are discovered

## What You'll See

1. **Planning** — Orchestrator node appears, status `planning`
2. **Pre-recon done** — Clusters and worker nodes appear (status `queued`)
3. **Workers dispatching** — Worker nodes flip to `running` one by one (2s delay between workers in local mode)
4. **Workers complete** — Status updates to `success` or `failed`, finding nodes appear if vulns found
5. **Completed** — Run status `completed`

## Sample App (Buggy Routes)

The `sample-app` has deliberately vulnerable routes:

- `POST /api/comments` — XSS (reflected input)
- Other routes discovered by pre-recon

Workers target these endpoints with attack payloads. Findings appear as nodes connected to the worker that discovered them.

## Troubleshooting

- **No graph updates?** Ensure you're on http://localhost:3000/dispatch (not the root page)
- **Mock data showing?** Start the scan first; the first write happens within ~5s. Refresh or wait for the next poll.
- **404 on dispatch-output.json?** Run the scan from `backend/` so it can resolve `frontend/public/`

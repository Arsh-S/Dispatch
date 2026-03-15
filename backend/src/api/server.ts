import 'dotenv/config';
import express from 'express';
import { runBlaxelConstructor } from '../orchestrator/constructor-dispatcher.js';
import type { ConstructorBootstrap } from '../workers/constructor/types.js';
import { fetchLinearIssue, parseGithubRepoFromIssueBody } from '../linear/issues.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { DiagnosticsAggregator } from '../diagnostics/aggregator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../..');

const app = express();
app.use(express.json());

// Shared diagnostics aggregator — populated by the dispatcher during runs
export const diagnosticsAggregator = new DiagnosticsAggregator();

/**
 * POST /api/fix
 * Body: { linear_issue_id: string, github_repo: string, app_config?: {...}, pr_config?: {...} }
 *
 * GET /fix?linear=DISP-123&github_repo=owner/repo
 *
 * Spawns a Blaxel construction worker to fix the Linear issue.
 */
app.post('/api/fix', async (req, res) => {
  try {
    let { linear_issue_id, github_repo, app_config, pr_config } = req.body;

    if (!linear_issue_id) {
      res.status(400).json({
        error: 'Missing required field: linear_issue_id',
      });
      return;
    }

    // Resolve github_repo: use from request, or fetch Linear issue and parse from body
    if (!github_repo) {
      try {
        const linear = await fetchLinearIssue(linear_issue_id);
        github_repo = parseGithubRepoFromIssueBody(linear.description);
      } catch (err: any) {
        console.warn(`[API /api/fix] Could not fetch Linear issue: ${err.message}`);
      }
      if (!github_repo) {
        res.status(400).json({
          error: 'Could not determine target repo. Either pass github_repo in the request body, or ensure the Linear issue was created by Dispatch (it embeds github_repo in the metadata).',
        });
        return;
      }
    }

    const bootstrap: ConstructorBootstrap = {
      construction_worker_id: `constructor-${Date.now()}`,
      triggered_at: new Date().toISOString(),
      triggered_by: 'api',
      timeout_seconds: 300,
      issue_source: 'linear',
      linear_issue: { id: linear_issue_id },
      github_repo,
      app_config: app_config ?? {
        runtime: 'python',
        install: 'pip install -r requirements.txt',
        start: 'python3 app.py',
        port: 5000,
      },
      pr_config: pr_config ?? {
        base_branch: 'main',
        branch_prefix: 'dispatch-fix',
      },
    };

    const result = await runBlaxelConstructor(bootstrap, { backendDir });

    res.json({
      success: result.status === 'fix_verified' || result.status === 'fix_unverified',
      result,
    });
  } catch (err: any) {
    console.error('[API /api/fix]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/fix', async (req, res) => {
  try {
    const linear = req.query.linear as string;
    let github_repo = req.query.github_repo as string;

    if (!linear) {
      res.status(400).send('Missing query param: linear (issue id)');
      return;
    }

    // Resolve github_repo from Linear issue body if not provided
    if (!github_repo) {
      try {
        const linearIssue = await fetchLinearIssue(linear);
        github_repo = parseGithubRepoFromIssueBody(linearIssue.description) ?? '';
      } catch (err: any) {
        console.warn(`[API /fix] Could not fetch Linear issue: ${err.message}`);
      }
      if (!github_repo) {
        res.status(400).send(
          'Could not determine target repo. Add ?github_repo=owner/repo to the URL, or ensure the Linear issue was created by Dispatch (it embeds github_repo in the metadata).'
        );
        return;
      }
    }

    const bootstrap: ConstructorBootstrap = {
      construction_worker_id: `constructor-${Date.now()}`,
      triggered_at: new Date().toISOString(),
      triggered_by: 'api',
      timeout_seconds: 300,
      issue_source: 'linear',
      linear_issue: { id: linear },
      github_repo,
      app_config: {
        runtime: 'python',
        install: 'pip install -r requirements.txt',
        start: 'python3 app.py',
        port: 5000,
      },
      pr_config: {
        base_branch: 'main',
        branch_prefix: 'dispatch-fix',
      },
    };

    const result = await runBlaxelConstructor(bootstrap, { backendDir });

    res.type('html').send(`
      <!DOCTYPE html>
      <html>
        <head><title>Dispatch Fix</title></head>
        <body>
          <h1>Dispatch Construction Worker</h1>
          <p><strong>Status:</strong> ${result.status}</p>
          ${result.pr ? `<p><a href="${result.pr.url}">PR #${result.pr.number}</a></p>` : ''}
          <p>${result.notes}</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[API /fix]', err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

// ---------------------------------------------------------------------------
// Diagnostics API
// ---------------------------------------------------------------------------

/**
 * GET /api/diagnostics — all active worker diagnostics
 */
app.get('/api/diagnostics', (_req, res) => {
  const all = diagnosticsAggregator.getAll();
  res.json({ workers: all, count: all.length });
});

/**
 * GET /api/diagnostics/alerts — loop detection alerts
 */
app.get('/api/diagnostics/alerts', (_req, res) => {
  const alerts = diagnosticsAggregator.getAlerts();
  res.json({ alerts, count: alerts.length });
});

/**
 * GET /api/diagnostics/:worker_id — single worker diagnostics
 */
app.get('/api/diagnostics/:worker_id', (req, res) => {
  const diag = diagnosticsAggregator.get(req.params.worker_id);
  if (!diag) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  res.json(diag);
});

export function startApiServer(port = 3333) {
  return app.listen(port, () => {
    console.log(`[Dispatch API] Listening on http://localhost:${port}`);
    console.log(`  POST /api/fix — spawn construction worker`);
    console.log(`  GET  /fix?linear=ISSUE-123&github_repo=owner/repo`);
    console.log(`  GET  /api/diagnostics — all worker diagnostics`);
    console.log(`  GET  /api/diagnostics/:worker_id — single worker`);
    console.log(`  GET  /api/diagnostics/alerts — loop alerts`);
  });
}

// Start server when run directly: pnpm api
startApiServer(parseInt(process.env.PORT ?? '3333', 10));

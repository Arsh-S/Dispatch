import 'dotenv/config';
import express from 'express';
import { runBlaxelConstructor } from '../orchestrator/constructor-dispatcher.js';
import type { ConstructorBootstrap } from '../workers/constructor/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../..');

const app = express();
app.use(express.json());

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
    const { linear_issue_id, github_repo, app_config, pr_config } = req.body;

    if (!linear_issue_id || !github_repo) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['linear_issue_id', 'github_repo'],
      });
      return;
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
        runtime: 'node',
        install: 'pnpm install',
        start: 'pnpm start',
        port: 3000,
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
    const github_repo = req.query.github_repo as string;

    if (!linear || !github_repo) {
      res.status(400).send('Missing query params: linear (issue id) and github_repo');
      return;
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
        runtime: 'node',
        install: 'pnpm install',
        start: 'pnpm start',
        port: 3000,
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

export function startApiServer(port = 3333) {
  return app.listen(port, () => {
    console.log(`[Dispatch API] Listening on http://localhost:${port}`);
    console.log(`  POST /api/fix — spawn construction worker`);
    console.log(`  GET  /fix?linear=ISSUE-123&github_repo=owner/repo`);
  });
}

// Start server when run directly: pnpm api
startApiServer(parseInt(process.env.PORT ?? '3333', 10));

import { SandboxInstance } from '@blaxel/core';
import type { ConstructorBootstrap } from '../workers/constructor/types.js';
import type { FixResult } from '../workers/constructor/types.js';
import fs from 'fs';
import path from 'path';

export interface RunBlaxelConstructorOptions {
  /** Path to backend root (for uploading constructor code) */
  backendDir: string;
}

/**
 * Spawn a construction worker in a Blaxel sandbox.
 * Clones the repo, runs the constructor, returns the fix result.
 */
export async function runBlaxelConstructor(
  bootstrap: ConstructorBootstrap,
  options: RunBlaxelConstructorOptions,
): Promise<FixResult> {
  const sandboxName = `dispatch-constructor-${bootstrap.construction_worker_id}`.slice(0, 63).replace(/[^a-z0-9-]/g, '-');
  let sandbox: SandboxInstance | null = null;

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN required for constructor (clone, push, PR)');
  }

  const [owner, repoName] = (bootstrap.github_repo ?? bootstrap.github_issue?.repo ?? '').split('/');
  if (!owner || !repoName) {
    throw new Error('github_repo required for constructor');
  }

  const cloneUrl = `https://x-access-token:${githubToken}@github.com/${owner}/${repoName}.git`;

  console.log(`[Blaxel Constructor] Creating sandbox ${sandboxName} for ${bootstrap.linear_issue?.id ?? `#${bootstrap.github_issue?.number}`}`);

  try {
    sandbox = await SandboxInstance.createIfNotExists({
      name: sandboxName,
      region: process.env.BL_REGION || 'us-pdx-1',
      ttl: '30m',  // NB - TTL is only 30 min.
    });

    // Upload backend (constructor + deps) before running anything
    console.log(`[Blaxel Constructor] Uploading backend to sandbox`);
    await uploadDirectory(sandbox, options.backendDir, '/dispatch-backend');

    await sandbox.fs.write('/dispatch/constructor-bootstrap.json', JSON.stringify(bootstrap, null, 2));

    // Launch constructor process — use waitForCompletion: false to avoid H2 10s timeout
    // bug in Blaxel SDK where timeout causes a fallback re-POST, creating a duplicate process.
    // Instead: start the process and poll manually with process.wait().
    const procName = `dispatch-${Date.now()}`;
    console.log(`[Blaxel Constructor] Running constructor in sandbox`);
    const gitAuthorName = process.env.DISPATCH_GIT_AUTHOR_NAME ?? 'Dispatch Agent';
    const gitAuthorEmail = process.env.DISPATCH_GIT_AUTHOR_EMAIL ?? 'dispatch-agent@dispatch.ai';
    const startedProcess = await sandbox.process.exec({
      name: procName,
      command: [
        `git clone ${cloneUrl} /repo`,
        `git config --global user.email "${gitAuthorEmail}"`,
        `git config --global user.name "${gitAuthorName}"`,
        'npm install --ignore-scripts --prefix /dispatch-backend',
        'npx tsx /dispatch-backend/src/workers/constructor/cli.ts /dispatch/constructor-bootstrap.json',
      ].join(' && '),
      workingDir: '/',
      waitForCompletion: false,
      env: {
        GITHUB_TOKEN: githubToken,
        LINEAR_API_KEY: process.env.LINEAR_API_KEY ?? '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
        REPO_DIR: '/repo',
        DISPATCH_GIT_AUTHOR_NAME: gitAuthorName,
        DISPATCH_GIT_AUTHOR_EMAIL: gitAuthorEmail,
      },
    });

    // Poll until the process finishes (up to 8 minutes)
    const execResult = await sandbox.process.wait(startedProcess.pid ?? procName, {
      maxWait: 480_000,
      interval: 3000,
    });

    // Fetch logs (wait() result may not include them)
    const logs = execResult.logs || await sandbox.process.logs(startedProcess.pid ?? procName).catch(() => '');
    if (logs) {
      console.log(`[Blaxel Constructor] logs:\n${logs.slice(-3000)}`);
    }

    // Read fix result — written by CLI even on fix_failed; only missing on hard crash
    const resultJson = await sandbox.fs.read('/dispatch/fix-result.json');
    const result = JSON.parse(resultJson) as FixResult;
    console.log(`[Blaxel Constructor] Completed: ${result.status}`);

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Blaxel Constructor] Failed: ${message}`);
    return {
      status: 'error',
      files_changed: [],
      notes: message,
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.delete();
        console.log(`[Blaxel Constructor] Sandbox ${sandboxName} deleted`);
      } catch {
        // TTL will handle cleanup
      }
    }
  }
}

async function uploadDirectory(
  sandbox: SandboxInstance,
  localDir: string,
  remotePath: string,
): Promise<void> {
  const SKIP = new Set(['node_modules', '.git', '.dispatch', 'data.db', 'data.db-shm', 'data.db-wal', 'dist', '.turbo']);

  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;

    const localPath = path.join(localDir, entry.name);
    const sandboxPath = `${remotePath}/${entry.name}`;

    if (entry.isDirectory()) {
      await uploadDirectory(sandbox, localPath, sandboxPath);
    } else {
      const content = fs.readFileSync(localPath, 'utf-8');
      await sandbox.fs.write(sandboxPath, content);
    }
  }
}

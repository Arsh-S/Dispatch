#!/usr/bin/env npx tsx
import 'dotenv/config';
/**
 * Generate a GitHub App installation token and bot identity for Dispatch.
 *
 * Use this after creating a GitHub App (see docs/github-bot-identity.md).
 * Outputs env vars for GITHUB_TOKEN and optional DISPATCH_GIT_AUTHOR_*.
 *
 * Usage:
 *   Add GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, and GITHUB_APP_PRIVATE_KEY_PATH to .env,
 *   then run: pnpm setup:github-app [--identity]
 *
 * Or inline:
 *   GITHUB_APP_ID=123 GITHUB_APP_INSTALLATION_ID=456 \
 *   GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem \
 *   pnpm setup:github-app [--identity]
 *
 * Add --identity to also output DISPATCH_GIT_AUTHOR_NAME and DISPATCH_GIT_AUTHOR_EMAIL
 * (fetches the app bot user from GitHub API).
 */

import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';

const APP_ID = process.env.GITHUB_APP_ID;
const INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID;
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
const PRIVATE_KEY_PATH = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
const WANT_IDENTITY = process.argv.includes('--identity');

function loadPrivateKey(): string {
  if (PRIVATE_KEY) {
    return PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  if (PRIVATE_KEY_PATH) {
    const resolved = path.resolve(PRIVATE_KEY_PATH);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Private key file not found: ${resolved}`);
    }
    return fs.readFileSync(resolved, 'utf-8');
  }
  throw new Error(
    'Set GITHUB_APP_PRIVATE_KEY (key content) or GITHUB_APP_PRIVATE_KEY_PATH (path to .pem)',
  );
}

async function main(): Promise<void> {
  if (!APP_ID || !INSTALLATION_ID) {
    console.error('Usage: Set GITHUB_APP_ID and GITHUB_APP_INSTALLATION_ID');
    console.error('');
    console.error('  GITHUB_APP_ID=123 \\');
    console.error('  GITHUB_APP_INSTALLATION_ID=456 \\');
    console.error('  GITHUB_APP_PRIVATE_KEY="$(cat private-key.pem)" \\');
    console.error('  pnpm tsx src/scripts/setup-github-app.ts [--identity]');
    process.exit(1);
  }

  const privateKey = loadPrivateKey();

  const auth = createAppAuth({
    appId: APP_ID,
    privateKey,
  });

  const { token } = await auth({
    type: 'installation',
    installationId: parseInt(INSTALLATION_ID, 10),
  });

  console.log('# Add these to your .env or export in your shell:');
  console.log(`GITHUB_TOKEN=${token}`);

  if (WANT_IDENTITY) {
    // GET /user returns 403 for installation tokens. Use GET /app (JWT) to get slug,
    // then GET /users/{slug}[bot] (public, no auth needed) to get the bot user.
    const { token: jwt } = await auth({ type: 'app' });
    const appOctokit = new Octokit({ auth: jwt });
    const { data: app } = await appOctokit.request('GET /app');
    const botLogin = `${app.slug}[bot]`;
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(botLogin)}`);
    if (!userRes.ok) throw new Error(`GET /users/${botLogin}: ${userRes.status}`);
    const user = (await userRes.json()) as { id: number; login: string };
    const email = `${user.id}+${user.login}@users.noreply.github.com`;
    console.log(`DISPATCH_GIT_AUTHOR_NAME=${user.login}`);
    console.log(`DISPATCH_GIT_AUTHOR_EMAIL=${email}`);
  }

  console.log('');
  console.log('# Token expires in ~1 hour. For long-running services, rotate tokens or use');
  console.log('# a token generation flow (e.g. on each constructor run).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

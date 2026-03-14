#!/usr/bin/env node
/**
 * Standalone CLI entry point for the construction worker.
 * Used by Blaxel sandboxes or local runs.
 *
 * Usage: pnpm tsx src/workers/constructor/cli.ts <constructor-bootstrap.json>
 *
 * The bootstrap JSON contains issue source (GitHub or Linear), app config, and PR config.
 * The process must run in a directory that has the target repo cloned (for applying fixes and opening PRs).
 */
import { runConstructionWorker } from './agent.js';
import type { ConstructorBootstrap } from './types.js';
import fs from 'fs';
import path from 'path';

const [bootstrapPath] = process.argv.slice(2);

if (!bootstrapPath) {
  console.error('Usage: pnpm tsx src/workers/constructor/cli.ts <constructor-bootstrap.json>');
  process.exit(1);
}

const resolved = path.resolve(bootstrapPath);
if (!fs.existsSync(resolved)) {
  console.error(`Bootstrap file not found: ${resolved}`);
  process.exit(1);
}

const bootstrap: ConstructorBootstrap = JSON.parse(fs.readFileSync(resolved, 'utf-8'));

runConstructionWorker(bootstrap)
  .then((result) => {
    // Write result for Blaxel/sandbox consumers
    const resultPath = path.join(path.dirname(path.resolve(bootstrapPath)), 'fix-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`[CLI] Constructor completed. Status: ${result.status}`);
    process.exit(result.status === 'fix_verified' || result.status === 'fix_unverified' ? 0 : 1);
  })
  .catch((err) => {
    console.error(`[CLI] Fatal error: ${err.message}`);
    process.exit(1);
  });

import path from 'path';

export const MEMORY_ENABLED = process.env.DISPATCH_MEMORY_ENABLED !== 'false';

export const ESCALATION_RULES = {
  consecutiveScansToCritical: parseInt(process.env.DISPATCH_ESCALATE_TO_CRITICAL ?? '4', 10),
  consecutiveScansToHigh: parseInt(process.env.DISPATCH_ESCALATE_TO_HIGH ?? '2', 10),
  lookbackRuns: parseInt(process.env.DISPATCH_MEMORY_LOOKBACK ?? '10', 10),
};

export function resolveTargetId(targetDir: string): string {
  return process.env.DISPATCH_TARGET_ID
    ?? process.env.GITHUB_REPO
    ?? path.basename(targetDir);
}

export function resolveDbPath(targetDir?: string): string {
  if (process.env.DISPATCH_MEMORY_DB_PATH) {
    return process.env.DISPATCH_MEMORY_DB_PATH;
  }
  const base = targetDir ?? process.cwd();
  return path.join(base, '.dispatch', 'memory.db');
}

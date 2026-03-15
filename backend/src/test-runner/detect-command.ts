import fs from 'fs';
import path from 'path';

export function detectTestCommand(targetDir: string): string {
  const pyprojectPath = path.join(targetDir, 'pyproject.toml');
  const packageJsonPath = path.join(targetDir, 'package.json');

  // Python project
  if (fs.existsSync(pyprojectPath)) {
    const uvLock = path.join(targetDir, 'uv.lock');
    if (fs.existsSync(uvLock)) {
      return 'uv run pytest';
    }
    return 'python -m pytest';
  }

  // Node project
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check if test script exists
    if (!pkg.scripts?.test) {
      return 'echo "No test script found in package.json"';
    }

    // Detect package manager from lockfile
    const pnpmLock = path.join(targetDir, 'pnpm-lock.yaml');
    const yarnLock = path.join(targetDir, 'yarn.lock');

    if (fs.existsSync(pnpmLock)) return 'pnpm test';
    if (fs.existsSync(yarnLock)) return 'yarn test';
    return 'npm test';
  }

  return 'npm test';
}

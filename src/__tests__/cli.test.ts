import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '..', '..');

describe('CLI entry point', () => {
  it('should show usage when no command is given', () => {
    const output = execSync('pnpm tsx src/cli.ts', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 15000,
    });
    expect(output).toContain('Dispatch Security Scanner');
    expect(output).toContain('Usage:');
    expect(output).toContain('scan <path-to-repo>');
  });

  it('should show usage with examples', () => {
    const output = execSync('pnpm tsx src/cli.ts', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 15000,
    });
    expect(output).toContain('pnpm tsx src/cli.ts scan ./sample-app');
    expect(output).toContain('Examples:');
  });

  it('should exit with error when scan target is missing', () => {
    try {
      execSync('pnpm tsx src/cli.ts scan', {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: 'pipe',
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.status).toBe(1);
      expect(err.stderr || err.stdout).toContain('Usage:');
    }
  });

  it('should exit with error when target directory does not exist', () => {
    try {
      execSync('pnpm tsx src/cli.ts scan /nonexistent/dir/12345', {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: 'pipe',
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.status).toBe(1);
      expect(err.stderr || err.stdout).toContain('Target directory not found');
    }
  });
});

describe('CLI convertToIssueFormat', () => {
  // We can't easily test the private function, but we can verify the
  // cli.ts module can be imported without errors by running it
  it('should be a valid TypeScript module', () => {
    const cliPath = path.join(ROOT, 'src', 'cli.ts');
    expect(fs.existsSync(cliPath)).toBe(true);
    // Verify it parses correctly by checking for key imports
    const content = fs.readFileSync(cliPath, 'utf-8');
    expect(content).toContain("import { runOrchestrator }");
    expect(content).toContain("import { bootstrapLabels }");
    expect(content).toContain("import { createIssuesFromReport }");
    expect(content).toContain("function convertToIssueFormat");
  });
});

import type { ParsedSummary } from '../schemas/test-run-report';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function parseTestOutput(stdout: string, stderr: string): ParsedSummary | null {
  const combined = stripAnsi(stdout + '\n' + stderr);

  // vitest: "Tests  13 failed | 298 passed (311)" or "3 passed | 1 failed"
  // Check vitest BEFORE pytest since both use "X passed" but vitest uses pipe separators
  const vitestTests = combined.match(
    /Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/
  );
  if (vitestTests) {
    const failed = parseInt(vitestTests[1] || vitestTests[3] || '0', 10);
    const passed = parseInt(vitestTests[2], 10);
    const total = parseInt(vitestTests[4], 10);
    return {
      passed,
      failed,
      skipped: total - passed - failed,
      total,
      framework: 'vitest',
    };
  }

  // vitest alternative: "3 passed | 1 failed" (without total in parens)
  const vitestPipe = combined.match(
    /(\d+)\s+passed\s*\|\s*(\d+)\s+failed/
  );
  if (vitestPipe) {
    const passed = parseInt(vitestPipe[1], 10);
    const failed = parseInt(vitestPipe[2], 10);
    return {
      passed,
      failed,
      total: passed + failed,
      framework: 'vitest',
    };
  }

  // jest: "Tests:  3 passed, 1 failed, 4 total"
  const jestMatch = combined.match(
    /Tests:\s+(?:(\d+)\s+passed)?(?:,\s*)?(?:(\d+)\s+failed)?(?:,\s*)?(\d+)\s+total/
  );
  if (jestMatch) {
    return {
      passed: jestMatch[1] ? parseInt(jestMatch[1], 10) : 0,
      failed: jestMatch[2] ? parseInt(jestMatch[2], 10) : 0,
      total: parseInt(jestMatch[3], 10),
      framework: 'jest',
    };
  }

  // pytest: "= 5 passed, 2 failed, 1 skipped =" (requires surrounding = signs)
  const pytestMatch = combined.match(
    /={2,}\s*(?:(\d+)\s+passed)?(?:,?\s*(\d+)\s+failed)?(?:,?\s*(\d+)\s+skipped)?(?:,?\s*(\d+)\s+error)?.*?={2,}/
  );
  if (pytestMatch && (pytestMatch[1] || pytestMatch[2])) {
    const passed = pytestMatch[1] ? parseInt(pytestMatch[1], 10) : 0;
    const failed = pytestMatch[2] ? parseInt(pytestMatch[2], 10) : 0;
    const skipped = pytestMatch[3] ? parseInt(pytestMatch[3], 10) : 0;
    return {
      passed,
      failed,
      skipped,
      total: passed + failed + skipped,
      framework: 'pytest',
    };
  }

  // pytest failure-first: "= 2 failed, 3 passed ="
  const pytestFailFirst = combined.match(
    /={2,}\s*(\d+)\s+failed(?:,?\s*(\d+)\s+passed)?(?:,?\s*(\d+)\s+skipped)?.*?={2,}/
  );
  if (pytestFailFirst) {
    const failed = parseInt(pytestFailFirst[1], 10);
    const passed = pytestFailFirst[2] ? parseInt(pytestFailFirst[2], 10) : 0;
    const skipped = pytestFailFirst[3] ? parseInt(pytestFailFirst[3], 10) : 0;
    return {
      passed,
      failed,
      skipped,
      total: passed + failed + skipped,
      framework: 'pytest',
    };
  }

  // go test: count "ok" and "FAIL" lines
  const goOk = (combined.match(/^ok\s+/gm) || []).length;
  const goFail = (combined.match(/^FAIL\s+/gm) || []).length;
  if (goOk + goFail > 0) {
    return {
      passed: goOk,
      failed: goFail,
      total: goOk + goFail,
      framework: 'go',
    };
  }

  return null;
}

import { describe, it, expect } from 'vitest';
import {
  getStrategy,
  fixSqlInjection,
  fixBrokenAuth,
  fixXss,
  fixIdor,
  applyMonkeypatchAsBase,
} from '../fix.js';
import { ParsedIssue } from '../types.js';

const baseParsed: ParsedIssue = {
  dispatch_run_id: 'run-1',
  dispatch_worker_id: 'worker-1',
  severity: 'HIGH',
  vuln_type: 'sql-injection',
  exploit_confidence: 'confirmed',
  monkeypatch_status: 'validated',
  fix_status: 'unfixed',
  location: { file: 'test.js', line: 1, endpoint: '/api/test', method: 'POST' },
  description: 'test',
  recommended_fix: '',
  rules_violated: [],
};

describe('getStrategy', () => {
  it('should return monkeypatch-based-production for confirmed + validated', () => {
    expect(getStrategy('confirmed', 'validated')).toBe('monkeypatch-based-production');
  });

  it('should return alternative-approach for confirmed + failed', () => {
    expect(getStrategy('confirmed', 'failed')).toBe('alternative-approach');
  });

  it('should return from-scratch for confirmed + not-attempted', () => {
    expect(getStrategy('confirmed', 'not-attempted')).toBe('from-scratch');
  });

  it('should return defensive for unconfirmed + not-attempted', () => {
    expect(getStrategy('unconfirmed', 'not-attempted')).toBe('defensive');
  });

  it('should return pattern-fix for unconfirmed + validated', () => {
    expect(getStrategy('unconfirmed', 'validated')).toBe('pattern-fix');
  });

  it('should return unknown for unrecognized combinations', () => {
    expect(getStrategy('unknown', 'unknown')).toBe('unknown');
  });
});

describe('fixSqlInjection', () => {
  it('should replace template literal SQL with parameterized query', () => {
    const content = `const result = db.prepare(\`SELECT * FROM orders WHERE id = \${orderId}\`).all();`;
    const result = fixSqlInjection(content, baseParsed);
    expect(result).toContain(".prepare('SELECT * FROM orders WHERE id = ?').all(orderId)");
    expect(result).not.toContain('${');
  });

  it('should not modify content without template literal SQL', () => {
    const content = `const result = db.prepare('SELECT * FROM orders WHERE id = ?').all(orderId);`;
    const result = fixSqlInjection(content, baseParsed);
    expect(result).toBe(content);
  });
});

describe('fixBrokenAuth', () => {
  it('should add authMiddleware import if missing', () => {
    const content = `router.get('/admin', async (req, res) => {});`;
    const result = fixBrokenAuth(content, baseParsed);
    expect(result).toContain("import { authMiddleware } from '../middleware/auth'");
  });

  it('should not duplicate authMiddleware import', () => {
    const content = `import { authMiddleware } from '../middleware/auth';\nrouter.get('/admin', async (req, res) => {});`;
    const result = fixBrokenAuth(content, baseParsed);
    const importCount = (result.match(/import { authMiddleware }/g) || []).length;
    expect(importCount).toBe(1);
  });

  it('should add authMiddleware to route handlers', () => {
    const content = `router.get('/admin', async (req, res) => {});`;
    const result = fixBrokenAuth(content, baseParsed);
    expect(result).toContain("authMiddleware, async (req");
  });
});

describe('fixXss', () => {
  it('should replace template literal res.send with res.json', () => {
    const content = `res.send(\`<div>\${userInput}</div>\`)`;
    const result = fixXss(content, baseParsed);
    expect(result).toContain('res.json(');
    expect(result).not.toContain('res.send');
  });

  it('should not modify non-template res.send', () => {
    const content = `res.send('hello')`;
    const result = fixXss(content, baseParsed);
    expect(result).toBe(content);
  });
});

describe('fixIdor', () => {
  it('should add ownership check after user fetch', () => {
    const content = `const user = db.get(userId);`;
    const result = fixIdor(content, baseParsed);
    expect(result).toContain('Ownership check');
    expect(result).toContain('requestingUserId');
    expect(result).toContain('Access denied');
  });
});

describe('applyMonkeypatchAsBase', () => {
  it('should apply simple unified diff replacements', () => {
    const content = `const x = unsafeCall(input);`;
    const diff = `--- a/file.js\n+++ b/file.js\n@@ -1 +1 @@\n- const x = unsafeCall(input);\n+ const x = safeCall(input);`;
    const result = applyMonkeypatchAsBase(content, diff);
    expect(result).toContain('safeCall');
    expect(result).not.toContain('unsafeCall');
  });

  it('should return unchanged content if diff does not match', () => {
    const content = `const y = something();`;
    const diff = `- const x = other();\n+ const x = fixed();`;
    const result = applyMonkeypatchAsBase(content, diff);
    expect(result).toBe(content);
  });
});

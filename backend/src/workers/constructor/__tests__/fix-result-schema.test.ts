import { describe, it, expect } from 'vitest';
import { FixResultSchema } from '../types';

describe('FixResultSchema', () => {
  it('should validate a complete fix result', () => {
    const input = {
      status: 'fix_verified',
      files_changed: ['src/routes/comments.ts'],
      validation: { result: 'PASS', response: 'XSS fix validated' },
      pr: { number: 42, url: 'https://github.com/owner/repo/pull/42', branch: 'fix/xss-42' },
      notes: 'Replaced res.send() with res.json()',
    };

    const result = FixResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('fix_verified');
      expect(result.data.files_changed).toEqual(['src/routes/comments.ts']);
    }
  });

  it('should apply defaults for optional fields', () => {
    const minimal = { status: 'fix_failed' };
    const result = FixResultSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files_changed).toEqual([]);
      expect(result.data.notes).toBe('');
      expect(result.data.validation).toBeNull();
      expect(result.data.pr).toBeNull();
    }
  });

  it('should reject an invalid status', () => {
    const input = { status: 'invalid_status' };
    const result = FixResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept all valid status values', () => {
    const statuses = ['fix_verified', 'fix_unverified', 'fix_failed', 'timeout', 'error'] as const;
    for (const status of statuses) {
      const result = FixResultSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('should validate PR fields when present', () => {
    const input = {
      status: 'fix_verified',
      pr: { number: 1, url: 'https://github.com/o/r/pull/1', branch: 'fix/branch' },
    };
    const result = FixResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pr?.number).toBe(1);
      expect(result.data.pr?.url).toBe('https://github.com/o/r/pull/1');
    }
  });

  it('should reject PR with missing required fields', () => {
    const input = {
      status: 'fix_verified',
      pr: { number: 1 }, // missing url and branch
    };
    const result = FixResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

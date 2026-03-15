import { describe, it, expect } from 'vitest';
import { extractFixedContent } from '../llm-fix.js';

describe('extractFixedContent', () => {
  it('happy path — returns content inside tags', () => {
    expect(extractFixedContent('<fixed_file>def foo(): pass</fixed_file>')).toBe('def foo(): pass');
  });

  it('UNABLE_TO_FIX — returns null', () => {
    expect(extractFixedContent('<fixed_file>UNABLE_TO_FIX</fixed_file>')).toBeNull();
  });

  it('no tags — returns null', () => {
    expect(extractFixedContent('Here is the fix: def foo(): pass')).toBeNull();
  });

  it('extra whitespace — trims content', () => {
    expect(extractFixedContent('<fixed_file>\n  code\n</fixed_file>')).toBe('code');
  });
});

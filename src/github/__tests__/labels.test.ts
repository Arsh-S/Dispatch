import { describe, it, expect } from 'vitest';
import { DISPATCH_LABELS } from '../labels.js';

describe('labels', () => {
  describe('DISPATCH_LABELS', () => {
    it('should have 15 total labels', () => {
      expect(DISPATCH_LABELS).toHaveLength(15);
    });

    it('should have unique label names', () => {
      const names = DISPATCH_LABELS.map(l => l.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('should have valid hex colors (6 chars, no # prefix)', () => {
      for (const label of DISPATCH_LABELS) {
        expect(label.color).toMatch(/^[0-9a-f]{6}$/);
      }
    });

    it('should have non-empty descriptions', () => {
      for (const label of DISPATCH_LABELS) {
        expect(label.description.length).toBeGreaterThan(0);
      }
    });

    it('should include all severity levels', () => {
      const names = DISPATCH_LABELS.map(l => l.name);
      expect(names).toContain('severity:critical');
      expect(names).toContain('severity:high');
      expect(names).toContain('severity:medium');
      expect(names).toContain('severity:low');
    });

    it('should include all exploit confidence levels', () => {
      const names = DISPATCH_LABELS.map(l => l.name);
      expect(names).toContain('exploit:confirmed');
      expect(names).toContain('exploit:unconfirmed');
    });

    it('should include all monkeypatch statuses', () => {
      const names = DISPATCH_LABELS.map(l => l.name);
      expect(names).toContain('monkeypatch:validated');
      expect(names).toContain('monkeypatch:failed');
      expect(names).toContain('monkeypatch:not-attempted');
    });

    it('should include all fix statuses', () => {
      const names = DISPATCH_LABELS.map(l => l.name);
      expect(names).toContain('fix:unfixed');
      expect(names).toContain('fix:in-progress');
      expect(names).toContain('fix:verified');
      expect(names).toContain('fix:unverified');
      expect(names).toContain('fix:failed');
    });

    it('should include the dispatch metadata label', () => {
      const names = DISPATCH_LABELS.map(l => l.name);
      expect(names).toContain('dispatch');
    });
  });
});

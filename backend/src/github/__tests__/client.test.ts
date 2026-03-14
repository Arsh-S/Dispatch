import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @octokit/rest before importing client
vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    auth: string | undefined;
    constructor(opts?: { auth?: string }) {
      this.auth = opts?.auth;
    }
  },
}));

describe('client', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GITHUB_TOKEN;
  });

  describe('parseRepo', () => {
    it('should parse a valid owner/repo string', async () => {
      const { parseRepo } = await import('../client.js');
      const result = parseRepo('octocat/hello-world');
      expect(result).toEqual({ owner: 'octocat', repo: 'hello-world' });
    });

    it('should throw for a string without a slash', async () => {
      const { parseRepo } = await import('../client.js');
      expect(() => parseRepo('invalid')).toThrow('Invalid repo format');
    });

    it('should throw for an empty string', async () => {
      const { parseRepo } = await import('../client.js');
      expect(() => parseRepo('')).toThrow('Invalid repo format');
    });

    it('should throw for a string with only a slash', async () => {
      const { parseRepo } = await import('../client.js');
      expect(() => parseRepo('/')).toThrow('Invalid repo format');
    });

    it('should handle repos with hyphens and dots', async () => {
      const { parseRepo } = await import('../client.js');
      const result = parseRepo('my-org/my.repo-name');
      expect(result).toEqual({ owner: 'my-org', repo: 'my.repo-name' });
    });
  });

  describe('getOctokit', () => {
    it('should throw if GITHUB_TOKEN is not set', async () => {
      const { getOctokit } = await import('../client.js');
      expect(() => getOctokit()).toThrow('GITHUB_TOKEN environment variable is required');
    });

    it('should return an Octokit instance when GITHUB_TOKEN is set', async () => {
      process.env.GITHUB_TOKEN = 'ghp_testtoken123';
      const { getOctokit } = await import('../client.js');
      const octokit = getOctokit();
      expect(octokit).toBeDefined();
    });

    it('should return the same instance on subsequent calls', async () => {
      process.env.GITHUB_TOKEN = 'ghp_testtoken123';
      const { getOctokit } = await import('../client.js');
      const first = getOctokit();
      const second = getOctokit();
      expect(first).toBe(second);
    });
  });
});

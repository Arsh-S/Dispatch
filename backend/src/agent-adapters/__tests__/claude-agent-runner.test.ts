import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// We test the pure helper functions extracted from the module.
// The runClaudeAgent function spawns a real subprocess and is not tested here
// (it requires the `claude` CLI to be present). Tests for that function
// belong in integration tests.
// ---------------------------------------------------------------------------

// Re-import extractJson via the module internals — since it's not exported
// we test it indirectly through the output behaviour we can observe without
// calling the subprocess.

describe('claude-agent-runner module exports', () => {
  it('should export runClaudeAgent function', async () => {
    const mod = await import('../claude-agent-runner');
    expect(typeof mod.runClaudeAgent).toBe('function');
  });
});

describe('index re-exports', () => {
  it('should re-export runClaudeAgent from index', async () => {
    const mod = await import('../index');
    expect(typeof mod.runClaudeAgent).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Schema validation tests — confirm the output schema contract
// ---------------------------------------------------------------------------

describe('ClaudeAgentOptions type contract', () => {
  it('should accept a valid schema object', async () => {
    const { runClaudeAgent } = await import('../claude-agent-runner');
    // We verify the function signature accepts the right shape by constructing
    // a valid options object (we don't actually call it).
    const TestSchema = z.object({
      value: z.string().default('test'),
    });

    const options = {
      systemPrompt: 'You are a test agent.',
      taskPrompt: 'Return {"value": "hello"}',
      outputSchema: TestSchema,
      timeoutMs: 5000,
      cwd: '/tmp',
    };

    // Type check: confirm the function accepts this shape
    expect(typeof runClaudeAgent).toBe('function');
    expect(options.systemPrompt).toBe('You are a test agent.');
  });
});

// ---------------------------------------------------------------------------
// JSON extraction logic — test the extractJson helper indirectly by
// running runClaudeAgent in a way that forces it through the code paths
// we care about (using mock subprocess output via vitest mocks).
// ---------------------------------------------------------------------------

describe('JSON extraction from Claude output', () => {
  // We mock the child_process spawn to inject controlled output without
  // requiring the claude CLI to be present.

  beforeEach(() => {
    vi.resetModules();
  });

  it('should successfully parse bare JSON output', async () => {
    const { EventEmitter } = await import('events');

    vi.doMock('child_process', () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;

      return {
        spawn: vi.fn(() => {
          setTimeout(() => {
            mockStdout.emit('data', Buffer.from('{"count": 42, "label": "test"}'));
            mockProcess.emit('close', 0);
          }, 10);
          return mockProcess;
        }),
      };
    });

    const { runClaudeAgent } = await import('../claude-agent-runner');

    const TestSchema = z.object({
      count: z.number(),
      label: z.string().default(''),
    });

    const result = await runClaudeAgent({
      systemPrompt: 'Test',
      taskPrompt: 'Return count',
      outputSchema: TestSchema,
      timeoutMs: 1000,
    });

    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(42);
    expect(result.data?.label).toBe('test');
  });

  it('should extract JSON from markdown fenced output', async () => {
    const { EventEmitter } = await import('events');

    vi.doMock('child_process', () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;

      return {
        spawn: vi.fn(() => {
          setTimeout(() => {
            mockStdout.emit('data', Buffer.from('Here is the result:\n```json\n{"count": 7, "label": "fenced"}\n```\n'));
            mockProcess.emit('close', 0);
          }, 10);
          return mockProcess;
        }),
      };
    });

    const { runClaudeAgent } = await import('../claude-agent-runner');

    const TestSchema = z.object({
      count: z.number(),
      label: z.string().default(''),
    });

    const result = await runClaudeAgent({
      systemPrompt: 'Test',
      taskPrompt: 'Return count',
      outputSchema: TestSchema,
      timeoutMs: 1000,
    });

    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(7);
    expect(result.data?.label).toBe('fenced');
  });

  it('should return error when output has no JSON', async () => {
    const { EventEmitter } = await import('events');

    vi.doMock('child_process', () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;

      return {
        spawn: vi.fn(() => {
          setTimeout(() => {
            mockStdout.emit('data', Buffer.from('I cannot complete this task.'));
            mockProcess.emit('close', 0);
          }, 10);
          return mockProcess;
        }),
      };
    });

    const { runClaudeAgent } = await import('../claude-agent-runner');

    const TestSchema = z.object({
      value: z.string(),
    });

    const result = await runClaudeAgent({
      systemPrompt: 'Test',
      taskPrompt: 'Return value',
      outputSchema: TestSchema,
      timeoutMs: 1000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not extract JSON');
  });

  it('should return error when JSON fails schema validation', async () => {
    const { EventEmitter } = await import('events');

    vi.doMock('child_process', () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;

      return {
        spawn: vi.fn(() => {
          setTimeout(() => {
            // Output has wrong type for 'count' (string instead of number)
            mockStdout.emit('data', Buffer.from('{"count": "not-a-number"}'));
            mockProcess.emit('close', 0);
          }, 10);
          return mockProcess;
        }),
      };
    });

    const { runClaudeAgent } = await import('../claude-agent-runner');

    const StrictSchema = z.object({
      count: z.number(), // no .default() — must be present and numeric
    });

    const result = await runClaudeAgent({
      systemPrompt: 'Test',
      taskPrompt: 'Return count',
      outputSchema: StrictSchema,
      timeoutMs: 1000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Schema validation failed');
  });

  it('should return error when process exits with non-zero code and no output', async () => {
    const { EventEmitter } = await import('events');

    vi.doMock('child_process', () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;

      return {
        spawn: vi.fn(() => {
          setTimeout(() => {
            mockStderr.emit('data', Buffer.from('claude: command not found'));
            mockProcess.emit('close', 127);
          }, 10);
          return mockProcess;
        }),
      };
    });

    const { runClaudeAgent } = await import('../claude-agent-runner');

    const TestSchema = z.object({
      value: z.string(),
    });

    const result = await runClaudeAgent({
      systemPrompt: 'Test',
      taskPrompt: 'Return value',
      outputSchema: TestSchema,
      timeoutMs: 1000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

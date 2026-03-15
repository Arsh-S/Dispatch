import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the hybrid mode augmentation in runPreRecon.
 *
 * We mock runClaudeAgent to avoid spawning real Claude subprocess.
 * Static mode behaviour is tested in the existing pre-recon.test.ts.
 */

beforeEach(() => {
  vi.resetModules();
});

describe('runPreRecon hybrid mode', () => {
  it('should fall back to static results when Claude agent fails', async () => {
    // Mock the agent adapter to simulate failure
    vi.doMock('../../agent-adapters/claude-agent-runner', () => ({
      runClaudeAgent: vi.fn().mockResolvedValue({
        success: false,
        error: 'Claude CLI not found',
      }),
    }));

    // Mock fs and glob to avoid real filesystem access
    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue(''),
        readdirSync: vi.fn().mockReturnValue([]),
      },
    }));

    vi.doMock('glob', () => ({
      glob: vi.fn().mockResolvedValue([]),
    }));

    const { runPreRecon } = await import('../pre-recon');

    const result = await runPreRecon({
      targetDir: '/tmp/fake-target',
      dispatchRunId: 'test-run-hybrid-001',
      mode: 'hybrid',
    });

    // Should still return a valid deliverable
    expect(result.dispatch_run_id).toBe('test-run-hybrid-001');
    expect(Array.isArray(result.route_map)).toBe(true);
    expect(Array.isArray(result.risk_signals)).toBe(true);
    // No Claude additions since agent failed
    expect(result.briefing_notes).not.toContain('[Claude Augmentation');
  });

  it('should merge Claude-discovered routes into static results', async () => {
    const mockAdditionalRoute = {
      endpoint: 'GET /api/admin/users',
      method: 'GET',
      handler_file: 'src/routes/admin.ts',
      handler_line: 10,
      middleware: [],
      parameters: [],
    };

    vi.doMock('../../agent-adapters/claude-agent-runner', () => ({
      runClaudeAgent: vi.fn().mockResolvedValue({
        success: true,
        data: {
          additional_routes: [mockAdditionalRoute],
          additional_risk_signals: [],
          briefing_notes: 'Found admin route missed by static analysis.',
          confidence: 'high',
        },
      }),
    }));

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue(''),
        readdirSync: vi.fn().mockReturnValue([]),
      },
    }));

    vi.doMock('glob', () => ({
      glob: vi.fn().mockResolvedValue([]),
    }));

    const { runPreRecon } = await import('../pre-recon');

    const result = await runPreRecon({
      targetDir: '/tmp/fake-target',
      dispatchRunId: 'test-run-hybrid-002',
      mode: 'hybrid',
    });

    // The Claude-discovered route should be included
    const adminRoute = result.route_map.find(r => r.endpoint === 'GET /api/admin/users');
    expect(adminRoute).toBeDefined();

    // Briefing should include Claude augmentation note
    expect(result.briefing_notes).toContain('[Claude Augmentation');
    expect(result.briefing_notes).toContain('confidence: high');
    expect(result.briefing_notes).toContain('Found admin route missed by static analysis.');
  });

  it('should merge Claude-discovered risk signals into static results', async () => {
    const mockSignal = {
      file: 'src/routes/payments.ts',
      line: 88,
      pattern: 'missing-auth-middleware',
      snippet: 'router.post("/charge", async (req, res)',
      suggested_attack_types: ['broken-auth', 'idor'],
    };

    vi.doMock('../../agent-adapters/claude-agent-runner', () => ({
      runClaudeAgent: vi.fn().mockResolvedValue({
        success: true,
        data: {
          additional_routes: [],
          additional_risk_signals: [mockSignal],
          briefing_notes: 'Payment endpoint lacks auth middleware.',
          confidence: 'medium',
        },
      }),
    }));

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue(''),
        readdirSync: vi.fn().mockReturnValue([]),
      },
    }));

    vi.doMock('glob', () => ({
      glob: vi.fn().mockResolvedValue([]),
    }));

    const { runPreRecon } = await import('../pre-recon');

    const result = await runPreRecon({
      targetDir: '/tmp/fake-target',
      dispatchRunId: 'test-run-hybrid-003',
      mode: 'hybrid',
    });

    const paymentSignal = result.risk_signals.find(s => s.file === 'src/routes/payments.ts');
    expect(paymentSignal).toBeDefined();
    expect(paymentSignal?.suggested_attack_types).toContain('broken-auth');
  });

  it('should not call Claude in static mode (default)', async () => {
    const mockRunClaudeAgent = vi.fn();

    vi.doMock('../../agent-adapters/claude-agent-runner', () => ({
      runClaudeAgent: mockRunClaudeAgent,
    }));

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue(''),
        readdirSync: vi.fn().mockReturnValue([]),
      },
    }));

    vi.doMock('glob', () => ({
      glob: vi.fn().mockResolvedValue([]),
    }));

    const { runPreRecon } = await import('../pre-recon');

    await runPreRecon({
      targetDir: '/tmp/fake-target',
      dispatchRunId: 'test-run-static-001',
      // no mode — defaults to 'static'
    });

    expect(mockRunClaudeAgent).not.toHaveBeenCalled();
  });

  it('should not call Claude when mode is explicitly static', async () => {
    const mockRunClaudeAgent = vi.fn();

    vi.doMock('../../agent-adapters/claude-agent-runner', () => ({
      runClaudeAgent: mockRunClaudeAgent,
    }));

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue(''),
        readdirSync: vi.fn().mockReturnValue([]),
      },
    }));

    vi.doMock('glob', () => ({
      glob: vi.fn().mockResolvedValue([]),
    }));

    const { runPreRecon } = await import('../pre-recon');

    await runPreRecon({
      targetDir: '/tmp/fake-target',
      dispatchRunId: 'test-run-static-002',
      mode: 'static',
    });

    expect(mockRunClaudeAgent).not.toHaveBeenCalled();
  });
});

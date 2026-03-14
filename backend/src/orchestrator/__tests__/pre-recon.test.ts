import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { runPreRecon } from '../pre-recon';
import { PreReconDeliverableSchema } from '../../schemas/pre-recon-deliverable';
import type { PreReconDeliverable } from '../../schemas/pre-recon-deliverable';

const SAMPLE_APP_DIR = path.resolve(__dirname, '../../../sample-app');

describe('runPreRecon', () => {
  let result: PreReconDeliverable;

  beforeAll(async () => {
    result = await runPreRecon({
      targetDir: SAMPLE_APP_DIR,
      dispatchRunId: 'test-run-001',
    });
  });

  it('should return a valid PreReconDeliverable', () => {
    const parsed = PreReconDeliverableSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('should use the provided dispatch run id', () => {
    expect(result.dispatch_run_id).toBe('test-run-001');
  });

  it('should set completed_at to a valid ISO timestamp', () => {
    const date = new Date(result.completed_at);
    expect(date.getTime()).not.toBeNaN();
  });

  describe('route map', () => {
    it('should discover routes from the sample app', () => {
      expect(result.route_map.length).toBeGreaterThan(0);
    });

    it('should detect GET and POST methods', () => {
      const methods = new Set(result.route_map.map(r => r.method));
      expect(methods.has('GET')).toBe(true);
      expect(methods.has('POST')).toBe(true);
    });

    it('should detect URL parameters', () => {
      const routeWithParams = result.route_map.find(r => r.parameters.some(p => p.source === 'params'));
      expect(routeWithParams).toBeDefined();
      expect(routeWithParams!.parameters.find(p => p.source === 'params')!.name).toBe('id');
    });

    it('should detect middleware on protected routes', () => {
      const routeWithMiddleware = result.route_map.find(r => r.middleware.length > 0);
      expect(routeWithMiddleware).toBeDefined();
    });

    it('should set handler_file to a relative path', () => {
      for (const route of result.route_map) {
        expect(route.handler_file).not.toContain(SAMPLE_APP_DIR);
        expect(route.handler_file).toMatch(/\.ts$/);
      }
    });

    it('should set handler_line to a positive number', () => {
      for (const route of result.route_map) {
        expect(route.handler_line).toBeGreaterThan(0);
      }
    });
  });

  describe('risk signals', () => {
    it('should detect risk signals in the sample app', () => {
      expect(result.risk_signals.length).toBeGreaterThan(0);
    });

    it('should include pattern names from the detection set', () => {
      const validPatterns = [
        'raw-sql-concatenation',
        'missing-auth-middleware',
        'xss-unsanitized-output',
        'hardcoded-secret',
        'dangerous-function',
        'error-detail-leak',
      ];
      for (const signal of result.risk_signals) {
        expect(validPatterns).toContain(signal.pattern);
      }
    });

    it('should include suggested attack types', () => {
      for (const signal of result.risk_signals) {
        expect(signal.suggested_attack_types.length).toBeGreaterThan(0);
      }
    });

    it('should detect XSS unsanitized output', () => {
      const xssSignal = result.risk_signals.find(s => s.pattern === 'xss-unsanitized-output');
      expect(xssSignal).toBeDefined();
      expect(xssSignal!.suggested_attack_types).toContain('xss');
    });

    it('should detect error detail leak', () => {
      const leakSignal = result.risk_signals.find(s => s.pattern === 'error-detail-leak');
      expect(leakSignal).toBeDefined();
      expect(leakSignal!.suggested_attack_types).toContain('open-debug');
    });
  });

  describe('dependency graph', () => {
    it('should detect the database layer', () => {
      expect(result.dependency_graph.db_layer).toBeDefined();
      expect(result.dependency_graph.db_layer).toContain('db');
    });

    it('should detect auth middleware', () => {
      expect(result.dependency_graph.auth_middleware).toBeDefined();
      expect(result.dependency_graph.auth_middleware).toContain('auth');
    });
  });

  describe('briefing notes', () => {
    it('should include route count', () => {
      expect(result.briefing_notes).toContain(`Found ${result.route_map.length} routes`);
    });

    it('should include risk signal count', () => {
      expect(result.briefing_notes).toContain(`${result.risk_signals.length} risk signals`);
    });

    it('should mention RULES.md when present', () => {
      expect(result.briefing_notes).toContain('RULES.md');
    });
  });
});

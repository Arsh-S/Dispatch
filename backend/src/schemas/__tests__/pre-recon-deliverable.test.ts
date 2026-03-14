import { describe, it, expect } from 'vitest';
import {
  RouteParameterSchema,
  RouteMapEntrySchema,
  RiskSignalSchema,
  DependencyGraphSchema,
  PreReconDeliverableSchema,
} from '../pre-recon-deliverable';

describe('PreReconDeliverable schemas', () => {
  describe('RouteParameterSchema', () => {
    it('should accept valid route parameters', () => {
      const result = RouteParameterSchema.safeParse({
        name: 'id',
        source: 'params',
        type: 'string',
      });
      expect(result.success).toBe(true);
    });

    it('should accept all valid source values', () => {
      for (const source of ['body', 'query', 'params', 'header'] as const) {
        const result = RouteParameterSchema.safeParse({
          name: 'test',
          source,
          type: 'string',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid source values', () => {
      const result = RouteParameterSchema.safeParse({
        name: 'id',
        source: 'invalid',
        type: 'string',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const result = RouteParameterSchema.safeParse({ name: 'id' });
      expect(result.success).toBe(false);
    });
  });

  describe('RouteMapEntrySchema', () => {
    it('should accept a valid route map entry', () => {
      const result = RouteMapEntrySchema.safeParse({
        endpoint: 'GET /api/users/:id',
        method: 'GET',
        handler_file: 'src/routes/users.ts',
        handler_line: 10,
        middleware: ['authMiddleware'],
        parameters: [{ name: 'id', source: 'params', type: 'string' }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty middleware and parameters arrays', () => {
      const result = RouteMapEntrySchema.safeParse({
        endpoint: 'GET /api/health',
        method: 'GET',
        handler_file: 'src/routes/health.ts',
        handler_line: 1,
        middleware: [],
        parameters: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('RiskSignalSchema', () => {
    it('should accept a valid risk signal', () => {
      const result = RiskSignalSchema.safeParse({
        file: 'src/routes/orders.ts',
        line: 30,
        pattern: 'error-detail-leak',
        snippet: 'res.status(500).json({ error: err.message });',
        suggested_attack_types: ['open-debug'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('DependencyGraphSchema', () => {
    it('should accept empty object', () => {
      const result = DependencyGraphSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept all optional fields', () => {
      const result = DependencyGraphSchema.safeParse({
        db_layer: 'src/db/connection.ts',
        orm: 'detected in src/models/index.ts',
        auth_middleware: 'src/middleware/auth.ts',
        session_store: 'detected in src/session.ts',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PreReconDeliverableSchema', () => {
    it('should accept a full valid deliverable', () => {
      const result = PreReconDeliverableSchema.safeParse({
        dispatch_run_id: 'dispatch-run-abc12',
        completed_at: '2026-03-14T18:00:00.000Z',
        route_map: [{
          endpoint: 'GET /api/users',
          method: 'GET',
          handler_file: 'src/routes/users.ts',
          handler_line: 5,
          middleware: [],
          parameters: [],
        }],
        risk_signals: [{
          file: 'src/routes/orders.ts',
          line: 30,
          pattern: 'error-detail-leak',
          snippet: 'res.status(500).json({ error: err.message });',
          suggested_attack_types: ['open-debug'],
        }],
        dependency_graph: { db_layer: 'src/db/connection.ts' },
        briefing_notes: 'Analysis complete.',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty arrays for routes and signals', () => {
      const result = PreReconDeliverableSchema.safeParse({
        dispatch_run_id: 'dispatch-run-00000',
        completed_at: '2026-03-14T18:00:00.000Z',
        route_map: [],
        risk_signals: [],
        dependency_graph: {},
        briefing_notes: 'No routes or signals found.',
      });
      expect(result.success).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { FindingSchema, FindingReportSchema, CleanEndpointSchema, ErrorDetailSchema } from '../finding-report';

describe('FindingSchema', () => {
  const validFinding = {
    finding_id: 'f-001',
    severity: 'HIGH' as const,
    vuln_type: 'sql-injection',
    exploit_confidence: 'confirmed' as const,
    location: {
      file: 'src/routes/users.ts',
      line: 42,
      endpoint: '/api/users',
      method: 'GET',
      parameter: 'id',
    },
    description: 'SQL injection via unsanitized user input',
    monkeypatch: {
      status: 'validated' as const,
      diff: '--- a/src/routes/users.ts\n+++ b/src/routes/users.ts',
    },
    recommended_fix: 'Use parameterized queries',
  };

  it('should parse a valid finding', () => {
    const result = FindingSchema.parse(validFinding);
    expect(result.finding_id).toBe('f-001');
    expect(result.severity).toBe('HIGH');
    expect(result.exploit_confidence).toBe('confirmed');
  });

  it('should apply defaults for server_logs and rules_violated', () => {
    const result = FindingSchema.parse(validFinding);
    expect(result.server_logs).toEqual([]);
    expect(result.rules_violated).toEqual([]);
  });

  it('should accept all severity levels', () => {
    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
      const result = FindingSchema.parse({ ...validFinding, severity });
      expect(result.severity).toBe(severity);
    }
  });

  it('should reject invalid severity', () => {
    expect(() => FindingSchema.parse({ ...validFinding, severity: 'UNKNOWN' })).toThrow();
  });

  it('should accept nullable parameter in location', () => {
    const finding = {
      ...validFinding,
      location: { ...validFinding.location, parameter: null },
    };
    const result = FindingSchema.parse(finding);
    expect(result.location.parameter).toBeNull();
  });

  it('should accept nullable reproduction', () => {
    const finding = { ...validFinding, reproduction: null };
    const result = FindingSchema.parse(finding);
    expect(result.reproduction).toBeNull();
  });
});

describe('FindingReportSchema', () => {
  const validReport = {
    dispatch_run_id: 'run-1',
    worker_id: 'w-1',
    completed_at: '2026-03-14T12:00:00.000Z',
    status: 'completed' as const,
    duration_seconds: 120,
  };

  it('should parse a valid report with defaults', () => {
    const result = FindingReportSchema.parse(validReport);
    expect(result.findings).toEqual([]);
    expect(result.clean_endpoints).toEqual([]);
    expect(result.error_detail).toBeNull();
  });

  it('should accept all valid status values', () => {
    const statuses = ['completed', 'timeout', 'app_start_failed', 'app_crash', 'network_error', 'auth_failed', 'config_error', 'worker_error'] as const;
    for (const status of statuses) {
      const result = FindingReportSchema.parse({ ...validReport, status });
      expect(result.status).toBe(status);
    }
  });

  it('should reject invalid status', () => {
    expect(() => FindingReportSchema.parse({ ...validReport, status: 'invalid' })).toThrow();
  });
});

describe('CleanEndpointSchema', () => {
  it('should parse a valid clean endpoint', () => {
    const result = CleanEndpointSchema.parse({
      endpoint: '/api/health',
      parameter: 'none',
      attack_type: 'sql-injection',
      notes: 'No injection points found',
    });
    expect(result.endpoint).toBe('/api/health');
  });
});

describe('ErrorDetailSchema', () => {
  it('should parse a valid error detail', () => {
    const result = ErrorDetailSchema.parse({
      type: 'network',
      code: 'ECONNREFUSED',
      message: 'Connection refused',
      retryable: true,
      phase: 'app_start',
    });
    expect(result.retryable).toBe(true);
    expect(result.phase).toBe('app_start');
  });
});

import { z } from 'zod';

export const FindingSchema = z.object({
  finding_id: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  cvss_score: z.number().optional(),
  owasp: z.string().optional(),
  vuln_type: z.string(),
  exploit_confidence: z.enum(['confirmed', 'unconfirmed']),
  location: z.object({
    file: z.string(),
    line: z.number(),
    endpoint: z.string(),
    method: z.string(),
    parameter: z.string().nullable().optional(),
  }),
  description: z.string(),
  reproduction: z.object({
    steps: z.array(z.string()).optional(),
    command: z.string(),
    expected: z.string(),
    actual: z.string(),
  }).nullable().optional(),
  server_logs: z.array(z.object({
    timestamp: z.string(),
    level: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  })).default([]),
  monkeypatch: z.object({
    status: z.enum(['validated', 'failed', 'not-attempted']),
    diff: z.string().nullable().optional(),
    validation: z.object({
      test: z.string(),
      result: z.string(),
      response: z.string().optional(),
      side_effects: z.string().optional(),
    }).nullable().optional(),
    post_patch_logs: z.array(z.object({
      timestamp: z.string(),
      level: z.string(),
      message: z.string(),
    })).nullable().optional(),
  }),
  recommended_fix: z.string(),
  rules_violated: z.array(z.string()).default([]),
});

export const CleanEndpointSchema = z.object({
  endpoint: z.string(),
  parameter: z.string(),
  attack_type: z.string(),
  notes: z.string(),
});

export const ErrorDetailSchema = z.object({
  type: z.string(),
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  phase: z.string(),
  suggestion: z.string().optional(),
});

export const FindingReportSchema = z.object({
  dispatch_run_id: z.string(),
  worker_id: z.string(),
  completed_at: z.string(),
  status: z.enum(['completed', 'timeout', 'app_start_failed', 'app_crash', 'network_error', 'auth_failed', 'config_error', 'worker_error']),
  duration_seconds: z.number(),
  error_detail: ErrorDetailSchema.nullable().default(null),
  findings: z.array(FindingSchema).default([]),
  clean_endpoints: z.array(CleanEndpointSchema).default([]),
  worker_notes: z.string().optional(),
});

export type Finding = z.infer<typeof FindingSchema>;
export type FindingReport = z.infer<typeof FindingReportSchema>;
export type CleanEndpoint = z.infer<typeof CleanEndpointSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

import { z } from 'zod';

export const ParsedSummarySchema = z.object({
  passed: z.number().optional(),
  failed: z.number().optional(),
  skipped: z.number().optional(),
  total: z.number().optional(),
  framework: z.string().optional(),
});

export const TestRunReportSchema = z.object({
  dispatch_run_id: z.string(),
  worker_id: z.string(),
  completed_at: z.string(),
  status: z.enum(['passed', 'failed', 'timeout', 'error']),
  exit_code: z.number().nullable(),
  duration_seconds: z.number(),
  command: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  parsed_summary: ParsedSummarySchema.optional(),
});

export type TestRunReport = z.infer<typeof TestRunReportSchema>;
export type ParsedSummary = z.infer<typeof ParsedSummarySchema>;

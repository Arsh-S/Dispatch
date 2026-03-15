import { z } from 'zod';

export const AgentDiagnosticsSchema = z.object({
  worker_id: z.string(),
  worker_type: z.enum(['pentester', 'constructor']),
  dispatch_run_id: z.string(),
  started_at: z.string(),
  updated_at: z.string(),
  wall_clock_seconds: z.number(),
  trace_length: z.number(),
  tool_calls: z.record(z.string(), z.number()),
  total_tool_calls: z.number(),
  lines_added: z.number(),
  lines_removed: z.number(),
  unique_files_touched: z.array(z.string()),
  repeated_calls: z.number(),
  error_count: z.number(),
  consecutive_errors: z.number(),
  phase: z.string(),
  findings_so_far: z.number(),
  last_action: z.string(),
  health_status: z.enum(['healthy', 'warning', 'looping']).default('healthy'),
});

export type AgentDiagnostics = z.infer<typeof AgentDiagnosticsSchema>;

export const LoopDetectionConfigSchema = z.object({
  max_trace_length: z.number().default(200),
  max_repetition_ratio: z.number().default(0.4),
  max_consecutive_errors: z.number().default(5),
  staleness_window_seconds: z.number().default(120),
  max_wall_clock_seconds: z.number().default(600),
});

export type LoopDetectionConfig = z.infer<typeof LoopDetectionConfigSchema>;

export type LoopAlertReason =
  | 'trace_length_exceeded'
  | 'high_repetition_ratio'
  | 'stale_no_new_actions'
  | 'error_spiral'
  | 'wall_clock_exceeded';

export type AlertConfidence = 'low' | 'medium' | 'high';

export const LoopAlertSchema = z.object({
  worker_id: z.string(),
  worker_type: z.enum(['pentester', 'constructor']),
  dispatch_run_id: z.string(),
  triggered_at: z.string(),
  reasons: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  diagnostics: AgentDiagnosticsSchema,
  auto_killed: z.boolean(),
});

export type LoopAlert = z.infer<typeof LoopAlertSchema>;

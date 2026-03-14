import { z } from 'zod';

export const TaskAssignmentSchema = z.object({
  dispatch_run_id: z.string(),
  worker_id: z.string(),
  assigned_at: z.string(),
  timeout_seconds: z.number().default(300),
  target: z.object({
    file: z.string(),
    line_range: z.tuple([z.number(), z.number()]).optional(),
    endpoint: z.string(),
    method: z.string(),
    parameters: z.array(z.string()).default([]),
  }),
  attack_type: z.string(),
  context: z.object({
    relevant_files: z.array(z.string()),
    api_keys: z.record(z.string(), z.string()).optional(),
    rules_md: z.array(z.string()).default([]),
    developer_notes: z.string().optional(),
  }),
  app_config: z.object({
    runtime: z.string(),
    install: z.string(),
    start: z.string(),
    port: z.number(),
    seed: z.string().optional(),
    env: z.record(z.string(), z.string()).default({}),
  }),
  briefing: z.string(),
});

export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;

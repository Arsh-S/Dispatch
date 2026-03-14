import { z } from 'zod';

export const RouteParameterSchema = z.object({
  name: z.string(),
  source: z.enum(['body', 'query', 'params', 'header']),
  type: z.string(),
});

export const RouteMapEntrySchema = z.object({
  endpoint: z.string(),
  method: z.string(),
  handler_file: z.string(),
  handler_line: z.number(),
  middleware: z.array(z.string()),
  parameters: z.array(RouteParameterSchema),
});

export const RiskSignalSchema = z.object({
  file: z.string(),
  line: z.number(),
  pattern: z.string(),
  snippet: z.string(),
  suggested_attack_types: z.array(z.string()),
});

export const DependencyGraphSchema = z.object({
  db_layer: z.string().optional(),
  orm: z.string().optional(),
  auth_middleware: z.string().optional(),
  session_store: z.string().optional(),
});

export const PreReconDeliverableSchema = z.object({
  dispatch_run_id: z.string(),
  completed_at: z.string(),
  route_map: z.array(RouteMapEntrySchema),
  risk_signals: z.array(RiskSignalSchema),
  dependency_graph: DependencyGraphSchema,
  briefing_notes: z.string(),
});

export type RouteMapEntry = z.infer<typeof RouteMapEntrySchema>;
export type RiskSignal = z.infer<typeof RiskSignalSchema>;
export type PreReconDeliverable = z.infer<typeof PreReconDeliverableSchema>;

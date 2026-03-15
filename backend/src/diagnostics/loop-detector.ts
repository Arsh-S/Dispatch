/**
 * LoopDetector — heuristic-based infinite loop detection for agent workers.
 *
 * Evaluates an AgentDiagnostics snapshot against configurable thresholds
 * and returns a LoopAlert if any heuristics fire.
 *
 * Confidence tiers (drive kill escalation in WorkerSupervisor):
 *   1 heuristic  → low    → warning only
 *   2 heuristics → medium → poison pill + grace period
 *   3+ heuristics → high  → immediate force kill
 */

import type {
  AgentDiagnostics,
  LoopAlert,
  LoopAlertReason,
  AlertConfidence,
  LoopDetectionConfig,
} from '../schemas/agent-diagnostics';

const DEFAULT_CONFIG: LoopDetectionConfig = {
  max_trace_length: 200,
  max_repetition_ratio: 0.4,
  max_consecutive_errors: 5,
  staleness_window_seconds: 120,
  max_wall_clock_seconds: 600,
};

export class LoopDetector {
  private config: LoopDetectionConfig;

  constructor(config?: Partial<LoopDetectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate a diagnostics snapshot. Returns a LoopAlert if any
   * heuristics fire, or null if the worker looks healthy.
   */
  evaluate(diagnostics: AgentDiagnostics): LoopAlert | null {
    const reasons: LoopAlertReason[] = [];

    // 1. Trace length exceeded
    if (diagnostics.trace_length > this.config.max_trace_length) {
      reasons.push('trace_length_exceeded');
    }

    // 2. High repetition ratio
    if (
      diagnostics.total_tool_calls > 10 &&
      diagnostics.repeated_calls / diagnostics.total_tool_calls > this.config.max_repetition_ratio
    ) {
      reasons.push('high_repetition_ratio');
    }

    // 3. Stale — no new actions
    const updatedAt = new Date(diagnostics.updated_at).getTime();
    const staleSince = (Date.now() - updatedAt) / 1000;
    if (staleSince > this.config.staleness_window_seconds) {
      reasons.push('stale_no_new_actions');
    }

    // 4. Error spiral
    if (diagnostics.consecutive_errors >= this.config.max_consecutive_errors) {
      reasons.push('error_spiral');
    }

    // 5. Wall clock exceeded
    if (diagnostics.wall_clock_seconds > this.config.max_wall_clock_seconds) {
      reasons.push('wall_clock_exceeded');
    }

    if (reasons.length === 0) return null;

    const confidence = this.deriveConfidence(reasons.length);

    return {
      worker_id: diagnostics.worker_id,
      worker_type: diagnostics.worker_type,
      dispatch_run_id: diagnostics.dispatch_run_id,
      triggered_at: new Date().toISOString(),
      reasons,
      confidence,
      diagnostics,
      auto_killed: false,
    };
  }

  /**
   * Derive health_status for a diagnostics snapshot.
   * Used by the diagnostics API/frontend — separate from kill decisions.
   *
   *   looping  → any heuristic fully triggered
   *   warning  → any heuristic at >75% of threshold
   *   healthy  → otherwise
   */
  getHealthStatus(diagnostics: AgentDiagnostics): 'healthy' | 'warning' | 'looping' {
    // Check for full triggers first
    const alert = this.evaluate(diagnostics);
    if (alert) return 'looping';

    // Check for near-threshold (75%+ of any limit)
    if (diagnostics.trace_length > this.config.max_trace_length * 0.75) return 'warning';

    if (
      diagnostics.total_tool_calls > 10 &&
      diagnostics.repeated_calls / diagnostics.total_tool_calls > this.config.max_repetition_ratio * 0.75
    ) {
      return 'warning';
    }

    const updatedAt = new Date(diagnostics.updated_at).getTime();
    const staleSince = (Date.now() - updatedAt) / 1000;
    if (staleSince > this.config.staleness_window_seconds * 0.75) return 'warning';

    if (diagnostics.consecutive_errors >= this.config.max_consecutive_errors * 0.75) return 'warning';

    if (diagnostics.wall_clock_seconds > this.config.max_wall_clock_seconds * 0.75) return 'warning';

    return 'healthy';
  }

  private deriveConfidence(reasonCount: number): AlertConfidence {
    if (reasonCount >= 3) return 'high';
    if (reasonCount === 2) return 'medium';
    return 'low';
  }
}

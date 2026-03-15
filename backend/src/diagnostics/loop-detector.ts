import type { AgentDiagnostics, LoopDetectionConfig, LoopAlert } from '../schemas/agent-diagnostics.js';
import { DEFAULT_LOOP_DETECTION_CONFIG } from '../schemas/agent-diagnostics.js';

export type HealthStatus = 'healthy' | 'warning' | 'looping';

/**
 * LoopDetector — heuristic-based evaluation of agent diagnostics to detect
 * infinite loops, error spirals, and staleness.
 */
export class LoopDetector {
  private config: LoopDetectionConfig;

  constructor(config?: Partial<LoopDetectionConfig>) {
    this.config = { ...DEFAULT_LOOP_DETECTION_CONFIG, ...config };
  }

  /**
   * Evaluate a diagnostics snapshot and return loop detection reasons.
   * Returns an empty array if the agent looks healthy.
   */
  evaluate(diag: AgentDiagnostics): string[] {
    const reasons: string[] = [];

    // 1. Trace length exceeded
    if (diag.trace_length > this.config.max_trace_length) {
      reasons.push(
        `Trace length ${diag.trace_length} exceeds max ${this.config.max_trace_length}`,
      );
    }

    // 2. Repetition ratio too high
    if (diag.total_tool_calls > 10) {
      const ratio = diag.repeated_calls / diag.total_tool_calls;
      if (ratio > this.config.max_repetition_ratio) {
        reasons.push(
          `Repetition ratio ${(ratio * 100).toFixed(1)}% exceeds max ${(this.config.max_repetition_ratio * 100).toFixed(1)}%`,
        );
      }
    }

    // 3. Consecutive error spiral
    if (diag.consecutive_errors >= this.config.max_consecutive_errors) {
      reasons.push(
        `${diag.consecutive_errors} consecutive errors (max ${this.config.max_consecutive_errors})`,
      );
    }

    // 4. Staleness — updated_at is too far in the past
    const updatedAt = new Date(diag.updated_at).getTime();
    const now = Date.now();
    const stalenessSeconds = (now - updatedAt) / 1000;
    if (stalenessSeconds > this.config.staleness_window_seconds) {
      reasons.push(
        `Stale for ${Math.round(stalenessSeconds)}s (max ${this.config.staleness_window_seconds}s)`,
      );
    }

    // 5. Wall clock exceeded
    if (diag.wall_clock_seconds > this.config.max_wall_clock_seconds) {
      reasons.push(
        `Wall clock ${diag.wall_clock_seconds}s exceeds max ${this.config.max_wall_clock_seconds}s`,
      );
    }

    return reasons;
  }

  /**
   * Determine overall health status for an agent.
   */
  getHealthStatus(diag: AgentDiagnostics): HealthStatus {
    const reasons = this.evaluate(diag);

    if (reasons.length === 0) {
      // Check for warning-level signals (approaching thresholds)
      const traceRatio = diag.trace_length / this.config.max_trace_length;
      const wallRatio = diag.wall_clock_seconds / this.config.max_wall_clock_seconds;
      const errorRatio = diag.consecutive_errors / this.config.max_consecutive_errors;

      if (traceRatio > 0.7 || wallRatio > 0.7 || errorRatio > 0.6) {
        return 'warning';
      }
      return 'healthy';
    }

    return 'looping';
  }

  /**
   * Build a LoopAlert from diagnostics if the agent is looping.
   * Returns null if healthy.
   */
  buildAlert(diag: AgentDiagnostics, autoKilled: boolean): LoopAlert | null {
    const reasons = this.evaluate(diag);
    if (reasons.length === 0) return null;

    return {
      worker_id: diag.worker_id,
      worker_type: diag.worker_type,
      dispatch_run_id: diag.dispatch_run_id,
      triggered_at: new Date().toISOString(),
      reasons,
      diagnostics: diag,
      auto_killed: autoKilled,
    };
  }
}

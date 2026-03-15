import type { MergedReport } from '../orchestrator/collector.js';

export interface MemoryStore {
  recordRun(targetId: string, runId: string, report: MergedReport): Promise<void>;
  getConsecutiveCounts(targetId: string, fingerprints: string[], lookback?: number): Promise<Map<string, number>>;
  getHistoryForFinding(targetId: string, fingerprint: string, limit?: number): Promise<FindingHistoryEntry[]>;
  close(): void;
}

export interface FindingHistoryEntry {
  run_id: string;
  completed_at: string;
  severity: string;
}

export interface MemoryContextForPR {
  consecutiveCount: number;
  history: FindingHistoryEntry[];
  escalatedFrom?: string;
}

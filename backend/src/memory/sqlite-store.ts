import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { MergedReport } from '../orchestrator/collector.js';
import type { MemoryStore, FindingHistoryEntry } from './types.js';
import { generateFindingFingerprint } from './fingerprint.js';
import { ESCALATION_RULES } from './config.js';

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL REFERENCES targets(id),
      completed_at TEXT NOT NULL,
      finding_count INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_runs_target_completed
      ON runs(target_id, completed_at DESC);

    CREATE TABLE IF NOT EXISTS finding_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id),
      fingerprint TEXT NOT NULL,
      severity TEXT NOT NULL,
      vuln_type TEXT NOT NULL,
      endpoint TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fo_run ON finding_occurrences(run_id);
    CREATE INDEX IF NOT EXISTS idx_fo_fingerprint ON finding_occurrences(fingerprint);
  `);
}

export function createSqliteStore(dbPath: string): MemoryStore {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);

  const upsertTarget = db.prepare(`
    INSERT INTO targets (id, first_seen, last_seen) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen
  `);

  const insertRun = db.prepare(`
    INSERT OR IGNORE INTO runs (id, target_id, completed_at, finding_count, summary_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertOccurrence = db.prepare(`
    INSERT INTO finding_occurrences (run_id, fingerprint, severity, vuln_type, endpoint)
    VALUES (?, ?, ?, ?, ?)
  `);

  const getRunsForTarget = db.prepare(`
    SELECT id, completed_at FROM runs
    WHERE target_id = ?
    ORDER BY completed_at DESC
    LIMIT ?
  `);

  const getFingerprintsForRun = db.prepare(`
    SELECT DISTINCT fingerprint FROM finding_occurrences WHERE run_id = ?
  `);

  const getHistory = db.prepare(`
    SELECT r.id AS run_id, r.completed_at, fo.severity
    FROM finding_occurrences fo
    JOIN runs r ON r.id = fo.run_id
    WHERE r.target_id = ? AND fo.fingerprint = ?
    ORDER BY r.completed_at DESC
    LIMIT ?
  `);

  const recordRunBatch = db.transaction((targetId: string, runId: string, report: MergedReport) => {
    const now = report.completed_at || new Date().toISOString();

    upsertTarget.run(targetId, now, now);
    insertRun.run(
      runId,
      targetId,
      now,
      report.findings.length,
      JSON.stringify(report.summary),
    );

    for (const finding of report.findings) {
      const fp = generateFindingFingerprint(finding);
      insertOccurrence.run(runId, fp, finding.severity, finding.vuln_type, finding.location.endpoint);
    }
  });

  return {
    async recordRun(targetId, runId, report) {
      recordRunBatch(targetId, runId, report);
    },

    async getConsecutiveCounts(targetId, fingerprints, lookback) {
      const limit = lookback ?? ESCALATION_RULES.lookbackRuns;
      const runs = getRunsForTarget.all(targetId, limit) as Array<{ id: string; completed_at: string }>;

      if (runs.length === 0) return new Map();

      const runFingerprints = new Map<string, Set<string>>();
      for (const run of runs) {
        const rows = getFingerprintsForRun.all(run.id) as Array<{ fingerprint: string }>;
        runFingerprints.set(run.id, new Set(rows.map(r => r.fingerprint)));
      }

      const result = new Map<string, number>();
      for (const fp of fingerprints) {
        let count = 0;
        for (const run of runs) {
          if (runFingerprints.get(run.id)!.has(fp)) {
            count++;
          } else {
            break;
          }
        }
        result.set(fp, count);
      }

      return result;
    },

    async getHistoryForFinding(targetId, fingerprint, limit = 10) {
      return getHistory.all(targetId, fingerprint, limit) as FindingHistoryEntry[];
    },

    close() {
      db.close();
    },
  };
}

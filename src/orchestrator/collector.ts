import { FindingReport, Finding, CleanEndpoint } from '../schemas/finding-report';
import crypto from 'crypto';

export interface MergedReport {
  dispatch_run_id: string;
  completed_at: string;
  duration_seconds: number;
  total_workers: number;
  findings: Finding[];
  clean_endpoints: CleanEndpoint[];
  worker_errors: Array<{
    worker_id: string;
    error: string;
    retryable: boolean;
  }>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total_endpoints: number;
    vulnerable_endpoints: number;
    clean_endpoints: number;
  };
}

export function mergeReports(reports: FindingReport[]): MergedReport {
  const allFindings: Finding[] = [];
  const allCleanEndpoints: CleanEndpoint[] = [];
  const workerErrors: MergedReport['worker_errors'] = [];
  let totalDuration = 0;

  for (const report of reports) {
    totalDuration = Math.max(totalDuration, report.duration_seconds);

    if (report.status !== 'completed') {
      workerErrors.push({
        worker_id: report.worker_id,
        error: report.error_detail?.message || report.status,
        retryable: report.error_detail?.retryable ?? false,
      });
    }

    allFindings.push(...report.findings);
    allCleanEndpoints.push(...report.clean_endpoints);
  }

  // Deduplicate findings by deterministic key
  const dedupedFindings = deduplicateFindings(allFindings);

  // Sort by severity
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  dedupedFindings.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  // Build summary
  const vulnerableEndpoints = new Set(dedupedFindings.map(f => f.location.endpoint));
  const cleanEndpointSet = new Set(allCleanEndpoints.map(c => c.endpoint));
  const allEndpoints = new Set([...vulnerableEndpoints, ...cleanEndpointSet]);

  return {
    dispatch_run_id: reports[0]?.dispatch_run_id || '',
    completed_at: new Date().toISOString(),
    duration_seconds: totalDuration,
    total_workers: reports.length,
    findings: dedupedFindings,
    clean_endpoints: allCleanEndpoints,
    worker_errors: workerErrors,
    summary: {
      critical: dedupedFindings.filter(f => f.severity === 'CRITICAL').length,
      high: dedupedFindings.filter(f => f.severity === 'HIGH').length,
      medium: dedupedFindings.filter(f => f.severity === 'MEDIUM').length,
      low: dedupedFindings.filter(f => f.severity === 'LOW').length,
      total_endpoints: allEndpoints.size,
      vulnerable_endpoints: vulnerableEndpoints.size,
      clean_endpoints: cleanEndpointSet.size,
    },
  };
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();

  for (const finding of findings) {
    const key = generateFindingKey(finding);
    if (!seen.has(key)) {
      seen.set(key, finding);
    } else {
      // Keep the one with higher confidence
      const existing = seen.get(key)!;
      if (finding.exploit_confidence === 'confirmed' && existing.exploit_confidence === 'unconfirmed') {
        seen.set(key, finding);
      }
    }
  }

  return [...seen.values()];
}

function generateFindingKey(finding: Finding): string {
  const raw = `${finding.location.endpoint}:${finding.location.parameter || ''}:${finding.vuln_type}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

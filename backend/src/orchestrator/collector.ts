import { FindingReport, Finding, CleanEndpoint } from '../schemas/finding-report';
import crypto from 'crypto';
import { isEnabled, sendEvent, sendMetrics } from '../integrations/datadog/client.js';
import { DatadogEvent, DatadogMetricSeries } from '../integrations/datadog/types.js';

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

/**
 * Content-based dedup key derived from the finding's semantic identity.
 * Two findings that target the same endpoint+parameter+vuln_type always
 * produce the same key, regardless of which worker discovered them.
 */
export function generateFindingKey(finding: Pick<Finding, 'location' | 'vuln_type'>): string {
  return contentBasedFindingHash(
    finding.location.endpoint,
    finding.location.parameter ?? '',
    finding.vuln_type,
  );
}

/**
 * SHA-256 truncated hash from the semantic triple (endpoint, parameter, vuln_type).
 * Shared by the dedup logic and the Claude post-parse adapter so finding_id
 * values are deterministic and collision-resistant across parallel workers.
 */
export function contentBasedFindingHash(
  endpoint: string,
  parameter: string | null | undefined,
  vulnType: string,
): string {
  const raw = `${endpoint}:${parameter || ''}:${vulnType}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

export async function forwardToDatadog(report: MergedReport): Promise<void> {
  if (!isEnabled()) return;

  const tags = [
    `dispatch_run_id:${report.dispatch_run_id}`,
    `findings_critical:${report.summary.critical}`,
    `findings_high:${report.summary.high}`,
    `findings_medium:${report.summary.medium}`,
    `findings_low:${report.summary.low}`,
  ];

  let alertType: DatadogEvent['alert_type'] = 'info';
  if (report.summary.critical > 0) alertType = 'error';
  else if (report.summary.high > 0) alertType = 'warning';

  const event: DatadogEvent = {
    title: `Dispatch Scan Complete: ${report.dispatch_run_id}`,
    text: [
      `**Findings:** ${report.findings.length} total`,
      `Critical: ${report.summary.critical} | High: ${report.summary.high} | Medium: ${report.summary.medium} | Low: ${report.summary.low}`,
      `**Endpoints:** ${report.summary.vulnerable_endpoints} vulnerable / ${report.summary.total_endpoints} total`,
      `**Workers:** ${report.total_workers} | Errors: ${report.worker_errors.length}`,
      `**Duration:** ${report.duration_seconds}s`,
    ].join('\n'),
    tags,
    alert_type: alertType,
    source_type_name: 'dispatch',
  };

  const now = Math.floor(Date.now() / 1000);
  const metricTags = [`dispatch_run_id:${report.dispatch_run_id}`];

  const series: DatadogMetricSeries[] = [
    { metric: 'dispatch.findings.critical', type: 1, points: [{ timestamp: now, value: report.summary.critical }], tags: metricTags },
    { metric: 'dispatch.findings.high', type: 1, points: [{ timestamp: now, value: report.summary.high }], tags: metricTags },
    { metric: 'dispatch.findings.medium', type: 1, points: [{ timestamp: now, value: report.summary.medium }], tags: metricTags },
    { metric: 'dispatch.findings.low', type: 1, points: [{ timestamp: now, value: report.summary.low }], tags: metricTags },
    { metric: 'dispatch.scan.duration_seconds', type: 1, points: [{ timestamp: now, value: report.duration_seconds }], tags: metricTags },
    { metric: 'dispatch.scan.workers', type: 1, points: [{ timestamp: now, value: report.total_workers }], tags: metricTags },
  ];

  await Promise.all([
    sendEvent(event),
    sendMetrics({ series }),
  ]);
}

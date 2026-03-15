import type { MergedReport } from '../orchestrator/collector.js';
import { generateFindingFingerprint } from './fingerprint.js';
import { ESCALATION_RULES } from './config.js';

export function applyEscalation(
  report: MergedReport,
  consecutiveCounts: Map<string, number>,
): MergedReport {
  const { consecutiveScansToCritical, consecutiveScansToHigh } = ESCALATION_RULES;

  const escalatedFindings = report.findings.map(f => {
    const fp = generateFindingFingerprint(f);
    const count = consecutiveCounts.get(fp) ?? 1;

    let severity = f.severity;
    let escalatedFrom: string | undefined;

    if (count >= consecutiveScansToCritical && (severity === 'HIGH' || severity === 'MEDIUM' || severity === 'LOW')) {
      escalatedFrom = severity;
      severity = 'CRITICAL';
    } else if (count >= consecutiveScansToHigh && (severity === 'MEDIUM' || severity === 'LOW')) {
      escalatedFrom = severity;
      severity = 'HIGH';
    }

    return {
      ...f,
      severity: severity as typeof f.severity,
      ...(escalatedFrom && { escalated_from: escalatedFrom, consecutive_count: count }),
      ...(!escalatedFrom && count > 1 && { consecutive_count: count }),
    };
  });

  const summary = {
    ...report.summary,
    critical: escalatedFindings.filter(f => f.severity === 'CRITICAL').length,
    high: escalatedFindings.filter(f => f.severity === 'HIGH').length,
    medium: escalatedFindings.filter(f => f.severity === 'MEDIUM').length,
    low: escalatedFindings.filter(f => f.severity === 'LOW').length,
  };

  return { ...report, findings: escalatedFindings, summary };
}

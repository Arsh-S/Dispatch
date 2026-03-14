import type { ScanResult } from '../types';

interface Props {
  result: ScanResult;
}

const SEVERITY_COLORS = {
  critical: '#5c0000',
  high: '#b60205',
  medium: '#e99695',
  low: '#fbca04',
};

export function ScanSummary({ result }: Props) {
  return (
    <div className="scan-summary">
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{result.findings.length}</span>
          <span className="stat-label">Total Findings</span>
        </div>
        <div className="stat" style={{ borderColor: SEVERITY_COLORS.critical }}>
          <span className="stat-value" style={{ color: SEVERITY_COLORS.critical }}>{result.summary.critical}</span>
          <span className="stat-label">Critical</span>
        </div>
        <div className="stat" style={{ borderColor: SEVERITY_COLORS.high }}>
          <span className="stat-value" style={{ color: SEVERITY_COLORS.high }}>{result.summary.high}</span>
          <span className="stat-label">High</span>
        </div>
        <div className="stat" style={{ borderColor: SEVERITY_COLORS.medium }}>
          <span className="stat-value" style={{ color: SEVERITY_COLORS.medium }}>{result.summary.medium}</span>
          <span className="stat-label">Medium</span>
        </div>
        <div className="stat" style={{ borderColor: SEVERITY_COLORS.low }}>
          <span className="stat-value" style={{ color: SEVERITY_COLORS.low }}>{result.summary.low}</span>
          <span className="stat-label">Low</span>
        </div>
      </div>
      <div className="summary-meta">
        <span>Duration: {result.duration_seconds}s</span>
        <span>Workers: {result.total_workers}</span>
        <span>Endpoints: {result.summary.total_endpoints} ({result.summary.vulnerable_endpoints} vulnerable, {result.summary.clean_endpoints} clean)</span>
        <span>Completed: {new Date(result.completed_at).toLocaleString()}</span>
      </div>
    </div>
  );
}

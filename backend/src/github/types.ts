export interface DispatchLabel {
  name: string;
  color: string;
  description: string;
}

export interface FindingForIssue {
  dispatch_run_id: string;
  dispatch_worker_id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvss_score?: number;
  owasp?: string;
  vuln_type: string;
  exploit_confidence: 'confirmed' | 'unconfirmed';
  monkeypatch_status: 'validated' | 'failed' | 'not-attempted';
  fix_status: string;
  location: {
    file: string;
    line: number;
    endpoint: string;
    method: string;
    parameter?: string | null;
  };
  description: string;
  reproduction?: {
    steps?: string[];
    command: string;
    expected: string;
    actual: string;
  } | null;
  server_logs?: Array<{
    timestamp: string;
    level: string;
    message: string;
    stack?: string;
  }>;
  monkeypatch?: {
    status: string;
    diff?: string | null;
    validation?: {
      test: string;
      result: string;
      response?: string;
      side_effects?: string;
    } | null;
    post_patch_logs?: Array<{
      timestamp: string;
      level: string;
      message: string;
    }> | null;
  };
  recommended_fix: string;
  rules_violated: string[];
  consecutive_count?: number;
  escalated_from?: string;
}

export interface CreatedIssue {
  number: number;
  url: string;
  title: string;
}

export interface Finding {
  finding_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvss_score?: number;
  owasp?: string;
  vuln_type: string;
  exploit_confidence: 'confirmed' | 'unconfirmed';
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
  }>;
  monkeypatch?: {
    status: 'validated' | 'failed' | 'not-attempted';
    diff?: string | null;
    validation?: {
      test: string;
      result: string;
      response?: string;
      side_effects?: string;
    } | null;
  };
  recommended_fix: string;
  rules_violated: string[];
  github_issue?: {
    number: number;
    url: string;
  };
}

export interface ScanResult {
  dispatch_run_id: string;
  completed_at: string;
  duration_seconds: number;
  total_workers: number;
  findings: Finding[];
  clean_endpoints: Array<{
    endpoint: string;
    parameter: string;
    attack_type: string;
    notes: string;
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

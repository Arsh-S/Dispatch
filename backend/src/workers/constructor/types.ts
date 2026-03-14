export interface ConstructorBootstrap {
  construction_worker_id: string;
  triggered_at: string;
  triggered_by: 'slack' | 'dashboard' | 'github' | 'api';
  timeout_seconds: number;
  github_issue: {
    repo: string;
    number: number;
  };
  app_config: {
    runtime: string;
    install: string;
    start: string;
    port: number;
    seed?: string;
    env?: Record<string, string>;
  };
  pr_config: {
    base_branch: string;
    branch_prefix: string;
  };
}

export interface ParsedIssue {
  dispatch_run_id: string;
  dispatch_worker_id: string;
  severity: string;
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
    parameter?: string;
  };
  description: string;
  reproduction_command?: string;
  monkeypatch_diff?: string;
  recommended_fix: string;
  rules_violated: string[];
}

export interface FixResult {
  status: 'fix_verified' | 'fix_unverified' | 'fix_failed' | 'timeout' | 'error';
  files_changed: string[];
  validation?: {
    result: 'PASS' | 'FAIL';
    response: string;
  };
  pr?: {
    number: number;
    url: string;
    branch: string;
  };
  notes: string;
}

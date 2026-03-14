export type IssueSource = 'github' | 'linear';

export interface ConstructorBootstrap {
  construction_worker_id: string;
  triggered_at: string;
  triggered_by: 'slack' | 'dashboard' | 'github' | 'linear' | 'api';
  timeout_seconds: number;
  /** GitHub issue source (when issue_source is 'github') */
  github_issue?: {
    repo: string;
    number: number;
  };
  /** Linear issue source (when issue_source is 'linear') — identifier e.g. DISP-123 */
  linear_issue?: {
    id: string; // Linear issue identifier (DISP-123) or UUID
  };
  /** Which system the issue comes from. Defaults to 'github' if github_issue present. */
  issue_source?: IssueSource;
  /** GitHub repo for PR (clone, push, open PR). Required. Inferred from github_issue.repo when using GitHub source. */
  github_repo?: string;
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

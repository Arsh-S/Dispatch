import { getOctokit, parseRepo } from '../../github/client.js';
import { ConstructorBootstrap, ParsedIssue, FixResult } from './types.js';

export async function postFixReport(
  bootstrap: ConstructorBootstrap,
  _parsed: ParsedIssue,
  fixResult: FixResult,
): Promise<void> {
  if (!bootstrap.github_issue) {
    throw new Error('postFixReport requires github_issue (use postFixReportToLinear for Linear)');
  }
  const octokit = getOctokit();
  const { owner, repo } = parseRepo(bootstrap.github_issue.repo);

  const body = formatFixReport(bootstrap, fixResult);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: bootstrap.github_issue.number,
    body,
  });
}

export function formatFixReport(bootstrap: ConstructorBootstrap, fixResult: FixResult): string {
  const duration = Math.round((Date.now() - new Date(bootstrap.triggered_at).getTime()) / 1000);

  return `## Dispatch Fix Report

**Status:** ${fixResult.status}
**Worker:** ${bootstrap.construction_worker_id}
**Duration:** ${duration}s

${fixResult.pr ? `### PR\n#${fixResult.pr.number} — \`${fixResult.pr.branch}\`` : '### No PR Created'}

### What Changed
${fixResult.files_changed.length > 0
    ? fixResult.files_changed.map(f => `- \`${f}\``).join('\n')
    : 'No files were modified.'}

${fixResult.validation ? `### Validation\n**Result:** ${fixResult.validation.result} — ${fixResult.validation.response}` : ''}

### Notes
${fixResult.notes}`;
}
